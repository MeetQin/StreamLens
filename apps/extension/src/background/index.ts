import { CaptureSession, exportRecordsToHar } from '@streamlens/core'
import type { SessionSnapshot, SessionUpdate } from '@streamlens/core'
import type { StreamEvent, StreamLensSettings, StreamRequest } from '@streamlens/protocol'
import { STREAMLENS_BRIDGE_SOURCE } from '@streamlens/protocol'
import { isValidBridgePayload } from '../shared/message-guard'
import { attachCdp, detachCdp, installCdpListener, resetCdpTabState } from './cdp-meta.js'
import {
  cancelScheduledPersist,
  clearCaptureState,
  clearPersisted,
  loadCaptureState,
  loadPersistedSession,
  persistNow,
  saveCaptureState,
  schedulePersist,
} from './session-store.js'
import { applySettingsToSession, getSettings, loadSettings, saveSettings } from './settings.js'

interface TabCapture {
  session: CaptureSession
  capturing: boolean
}

const byTab = new Map<number, TabCapture>()
const pendingTabs = new Map<number, Promise<TabCapture>>()
const devtoolsPorts = new Map<number, Set<chrome.runtime.Port>>()
const batchQueues = new Map<number, SessionUpdate[]>()
const batchTimers = new Map<number, ReturnType<typeof setTimeout>>()

function createTab(
  tabId: number,
  sessionId: string | undefined,
  persisted: SessionSnapshot | null,
): TabCapture {
  const session = new CaptureSession(tabId, sessionId, {
    enableAiAdapter: getSettings().enableAiAdapter,
    redactOnExport: getSettings().redactOnExport,
    limits: getSettings().limits,
  })
  applySettingsToSession(session)
  if (persisted) {
    session.replaceState(persisted.requests, persisted.eventsByRequest)
  }
  session.on((update) => {
    enqueueUpdate(tabId, update)
    schedulePersist(tabId, session)
  })
  return { session, capturing: false }
}

async function restoreTab(tabId: number): Promise<TabCapture> {
  await loadSettings().catch(() => undefined)
  const [captureState, persisted] = await Promise.all([
    loadCaptureState(tabId).catch(() => null),
    loadPersistedSession(tabId).catch(() => null),
  ])
  const t = createTab(tabId, captureState?.sessionId ?? persisted?.sessionId, persisted)
  t.capturing = captureState?.capturing === true
  byTab.set(tabId, t)
  return t
}

/** Restore per-tab state from chrome.storage.session after a service worker restart. */
async function ensureTab(tabId: number): Promise<TabCapture> {
  const existing = byTab.get(tabId)
  if (existing) return existing

  const pending = pendingTabs.get(tabId)
  if (pending) return pending

  const promise = restoreTab(tabId)
  pendingTabs.set(tabId, promise)
  try {
    return await promise
  } finally {
    pendingTabs.delete(tabId)
  }
}

function enqueueUpdate(tabId: number, update: SessionUpdate): void {
  const q = batchQueues.get(tabId) ?? []
  q.push(update)
  batchQueues.set(tabId, q)
  if (batchTimers.has(tabId)) return
  batchTimers.set(
    tabId,
    setTimeout(() => {
      batchTimers.delete(tabId)
      const updates = batchQueues.get(tabId) ?? []
      batchQueues.set(tabId, [])
      if (updates.length === 1) {
        broadcastToDevtools(tabId, { type: 'SESSION_UPDATE', update: updates[0] })
      } else if (updates.length > 1) {
        broadcastToDevtools(tabId, { type: 'SESSION_BATCH', updates })
      }
    }, 32),
  )
}

function resetUpdateQueue(tabId: number): void {
  batchQueues.delete(tabId)
  const timer = batchTimers.get(tabId)
  if (timer) clearTimeout(timer)
  batchTimers.delete(tabId)
}

function safePost(port: chrome.runtime.Port, payload: unknown): void {
  try {
    port.postMessage(payload)
  } catch {
    /* port disconnected while handling an async request */
  }
}

function broadcastToDevtools(tabId: number, payload: unknown): void {
  const ports = devtoolsPorts.get(tabId)
  if (!ports) return
  for (const port of ports) {
    try {
      port.postMessage(payload)
    } catch {
      /* disconnected */
    }
  }
}

function snapshot(t: TabCapture): {
  capturing: boolean
  sessionId: string
  requests: StreamRequest[]
  eventsByRequest: Record<string, StreamEvent[]>
} {
  const requests = t.session.getRequests()
  const eventsByRequest: Record<string, StreamEvent[]> = {}
  for (const r of requests) {
    eventsByRequest[r.id] = t.session.getEvents(r.id)
  }
  return {
    capturing: t.capturing,
    sessionId: t.session.sessionId,
    requests,
    eventsByRequest,
  }
}

async function stopCaptureForTab(tabId: number): Promise<void> {
  const t = byTab.get(tabId)
  if (t) {
    t.capturing = false
    t.session.finishOpenRequests('abort', 'Capture stopped')
    chrome.tabs
      .sendMessage(tabId, {
        type: 'STREAMLENS_UNREGISTER_SESSION',
        sessionId: t.session.sessionId,
      })
      .catch(() => undefined)
  }
  await clearCaptureState(tabId).catch(() => undefined)
  if (t) await persistNow(tabId, t.session).catch(() => undefined)
}

async function handleNavigation(tabId: number): Promise<void> {
  const navigationAt = Date.now()
  if (!byTab.has(tabId)) {
    const state = await loadCaptureState(tabId)
    if (!state) return
  }
  const t = await ensureTab(tabId)
  if (!t.capturing) return

  // Requests started after this point belong to the new document.
  for (const req of t.session.getRequests()) {
    if (req.state !== 'pending' && req.state !== 'streaming') continue
    if (req.startedAt > navigationAt) continue
    t.session.finishRequest(req.id, 'abort', 'Page navigation/reload')
  }
  resetCdpTabState(tabId)
  await persistNow(tabId, t.session).catch(() => undefined)
  broadcastToDevtools(tabId, {
    type: 'CAPTURE_STATE',
    capturing: true,
    sessionId: t.session.sessionId,
    reason: 'navigation',
  })
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'streamlens-devtools') return
  let tabId: number | undefined

  port.onMessage.addListener(async (msg) => {
    if (msg?.type === 'INIT' && typeof msg.tabId === 'number') {
      const initTabId = msg.tabId
      tabId = initTabId
      if (!devtoolsPorts.has(initTabId)) devtoolsPorts.set(initTabId, new Set())
      devtoolsPorts.get(initTabId)!.add(port)
      const t = await ensureTab(initTabId)
      port.postMessage({ type: 'SNAPSHOT', ...snapshot(t) })
      return
    }
    if (tabId === undefined) return

    const t = await ensureTab(tabId)

    switch (msg?.type) {
      case 'START_CAPTURE': {
        t.capturing = true
        await saveCaptureState(tabId, t.session.sessionId).catch(() => undefined)
        if (!t.capturing) {
          await clearCaptureState(tabId).catch(() => undefined)
          break
        }
        await chrome.tabs
          .sendMessage(tabId, {
            type: 'STREAMLENS_REGISTER_SESSION',
            sessionId: t.session.sessionId,
          })
          .catch(() => undefined)
        if (!t.capturing) {
          await clearCaptureState(tabId).catch(() => undefined)
          break
        }
        safePost(port, {
          type: 'CAPTURE_STATE',
          capturing: true,
          sessionId: t.session.sessionId,
        })
        // CDP is optional at runtime: attach failures must not block capture.
        if (getSettings().enableCdpMetadata || getSettings().enableCdpBodyStream) {
          try {
            ensureCdpListener()
            const r = await attachCdp(tabId)
            if (!r.ok) {
              safePost(port, { type: 'CDP_STATE', error: r.error ?? 'CDP attach failed' })
            }
          } catch (e) {
            safePost(port, {
              type: 'CDP_STATE',
              error: e instanceof Error ? e.message : 'CDP attach failed',
            })
          }
        }
        break
      }
      case 'STOP_CAPTURE': {
        await stopCaptureForTab(tabId)
        await detachCdp(tabId)
        port.postMessage({
          type: 'CAPTURE_STATE',
          capturing: false,
          sessionId: t.session.sessionId,
        })
        break
      }
      case 'CLEAR': {
        resetUpdateQueue(tabId)
        t.session.clear()
        cancelScheduledPersist(tabId)
        await clearPersisted(tabId).catch(() => undefined)
        port.postMessage({ type: 'SNAPSHOT', ...snapshot(t) })
        break
      }
      case 'EXPORT_REQUEST': {
        const data = t.session.exportRequest(msg.requestId)
        port.postMessage({ type: 'EXPORT_RESULT', data })
        break
      }
      case 'EXPORT_ALL': {
        port.postMessage({ type: 'EXPORT_RESULT', data: t.session.exportAll() })
        break
      }
      case 'EXPORT_HAR': {
        const records = t.session.exportAll()
        port.postMessage({ type: 'EXPORT_RESULT', data: exportRecordsToHar(records) })
        break
      }
      case 'EXPORT_REQUEST_HAR': {
        const rec = t.session.exportRequest(msg.requestId)
        port.postMessage({
          type: 'EXPORT_RESULT',
          data: rec ? exportRecordsToHar([rec]) : null,
        })
        break
      }
      case 'GET_SETTINGS': {
        port.postMessage({ type: 'SETTINGS', settings: getSettings() })
        break
      }
      case 'SET_SETTINGS': {
        const settings = msg.settings as StreamLensSettings
        await saveSettings(settings)
        applySettingsToSession(t.session)
        port.postMessage({ type: 'SETTINGS', settings: getSettings() })
        break
      }
      default:
        break
    }
  })

  port.onDisconnect.addListener(() => {
    if (tabId === undefined) return
    const set = devtoolsPorts.get(tabId)
    set?.delete(port)
  })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'STREAMLENS_HELLO' && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id
    void ensureTab(tabId)
      .then((t) => {
        sendResponse({
          capturing: t.capturing,
          sessionId: t.capturing ? t.session.sessionId : undefined,
        })
      })
      .catch(() => sendResponse({ capturing: false }))
    return true
  }
  if (message?.type === 'E2E_START_CAPTURE' && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id
    void ensureTab(tabId)
      .then(async (t) => {
        t.capturing = true
        await saveCaptureState(tabId, t.session.sessionId).catch(() => undefined)
        await chrome.tabs
          .sendMessage(tabId, {
            type: 'STREAMLENS_REGISTER_SESSION',
            sessionId: t.session.sessionId,
          })
          .catch(() => undefined)
        sendResponse({ ok: true, sessionId: t.session.sessionId })
      })
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === 'E2E_GET_SNAPSHOT' && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id
    void ensureTab(tabId)
      .then((t) => sendResponse(snapshot(t)))
      .catch(() => sendResponse(null))
    return true
  }

  if (message?.source !== STREAMLENS_BRIDGE_SOURCE) return
  const tabId = sender.tab?.id
  if (tabId === undefined) return
  if (!isValidBridgePayload(message as Record<string, unknown>)) return

  void ensureTab(tabId)
    .then((t) => {
      if (!t.capturing) return
      if (message.sessionId !== t.session.sessionId) return

      switch (message.type) {
        case 'REQUEST_STARTED': {
          t.session.startRequest({
            id: message.requestId,
            tabId,
            url: message.url,
            method: message.method,
            contentType: message.contentType,
            startedAt: message.startedAt,
            source: message.requestSource,
            state: 'pending',
          })
          break
        }
        case 'REQUEST_META': {
          t.session.updateRequestMeta(message.requestId, {
            status: message.status,
            contentType: message.contentType,
          })
          break
        }
        case 'SSE_CHUNK': {
          if (typeof message.chunk === 'string' && message.chunk.length > 512_000) return
          t.session.pushChunk(message.requestId, message.chunk)
          break
        }
        case 'ES_EVENT': {
          t.session.appendEventSourceMessage(message.requestId, {
            data: message.data,
            eventType: message.eventType,
            eventId: message.eventId,
          })
          break
        }
        case 'REQUEST_FINISHED': {
          t.session.finishRequest(message.requestId, message.reason, message.errorMessage)
          break
        }
        default:
          break
      }
    })
    .catch(() => undefined)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  pendingTabs.delete(tabId)
  cancelScheduledPersist(tabId)
  void detachCdp(tabId)
  void clearCaptureState(tabId)
  void clearPersisted(tabId)
  byTab.delete(tabId)
  devtoolsPorts.delete(tabId)
  resetUpdateQueue(tabId)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return
  void handleNavigation(tabId).catch(() => undefined)
})

function ensureCdpListener(): void {
  installCdpListener(
    (tabId) => byTab.get(tabId)?.session,
    (tabId) => byTab.get(tabId)?.capturing === true,
  )
}

ensureCdpListener()

void loadSettings().then(() => {
  for (const t of byTab.values()) {
    applySettingsToSession(t.session)
  }
})
