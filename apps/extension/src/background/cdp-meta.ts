import type { CaptureSession } from '@streamlens/core'
import { getSettings } from './settings.js'
import { decodeCdpIoData } from './cdp-decode.js'

const attachedTabs = new Set<number>()
/** networkRequestId → { slRequestId, tabId } */
const networkToSl = new Map<string, { slId: string; tabId: number }>()
const pumping = new Set<string>()

function debuggee(tabId: number): chrome.debugger.Debuggee {
  return { tabId }
}

function hasDebuggerApi(): boolean {
  return typeof chrome.debugger !== 'undefined'
}

function pumpKey(tabId: number, networkRequestId: string): string {
  return `${tabId}:${networkRequestId}`
}

/** Drop per-page CDP mappings after navigation without detaching the debugger. */
export function resetCdpTabState(tabId: number): void {
  for (const [netId, entry] of [...networkToSl.entries()]) {
    if (entry.tabId === tabId) networkToSl.delete(netId)
  }
  const prefix = `${tabId}:`
  for (const key of [...pumping]) {
    if (key.startsWith(prefix)) pumping.delete(key)
  }
}

function isStreamMime(mime: string): boolean {
  const m = mime.toLowerCase()
  return m.includes('event-stream') || m.includes('stream') || m.includes('ndjson')
}

export async function attachCdp(tabId: number): Promise<{ ok: boolean; error?: string }> {
  if (attachedTabs.has(tabId)) return { ok: true }
  if (!hasDebuggerApi()) return { ok: false, error: 'debugger permission is not granted' }
  try {
    await chrome.debugger.attach(debuggee(tabId), '1.3')
    await chrome.debugger.sendCommand(debuggee(tabId), 'Network.enable', {
      maxTotalBufferSize: 0,
      maxResourceBufferSize: 0,
    })
    attachedTabs.add(tabId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function detachCdp(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return
  if (!hasDebuggerApi()) {
    attachedTabs.delete(tabId)
    resetCdpTabState(tabId)
    return
  }
  try {
    await chrome.debugger.detach(debuggee(tabId))
  } catch {
    /* ignore */
  }
  attachedTabs.delete(tabId)
  resetCdpTabState(tabId)
}

async function pumpStreamResource(
  tabId: number,
  networkRequestId: string,
  slRequestId: string,
  session: CaptureSession,
): Promise<boolean> {
  const key = pumpKey(tabId, networkRequestId)
  if (pumping.has(key)) return true
  pumping.add(key)
  const dbg = debuggee(tabId)
  try {
    const opened = (await chrome.debugger.sendCommand(dbg, 'Network.streamResourceContent', {
      requestId: networkRequestId,
    })) as { stream?: string }
    const handle = opened.stream
    if (!handle) return false

    while (true) {
      const read = (await chrome.debugger.sendCommand(dbg, 'IO.read', {
        handle,
        size: 64 * 1024,
      })) as { data?: string; base64Encoded?: boolean; eof?: boolean }
      if (read.data) {
        session.pushChunk(slRequestId, decodeCdpIoData(read.data, read.base64Encoded))
      }
      if (read.eof) break
    }
    try {
      await chrome.debugger.sendCommand(dbg, 'IO.close', { handle })
    } catch {
      /* ignore */
    }
    session.finishRequest(slRequestId, 'eof')
    return true
  } catch {
    return false
  } finally {
    pumping.delete(key)
  }
}

async function fallbackGetResponseBody(
  tabId: number,
  networkRequestId: string,
  slRequestId: string,
  session: CaptureSession,
): Promise<void> {
  try {
    const body = (await chrome.debugger.sendCommand(debuggee(tabId), 'Network.getResponseBody', {
      requestId: networkRequestId,
    })) as { body?: string; base64Encoded?: boolean }
    if (body.body) {
      session.pushChunk(slRequestId, decodeCdpIoData(body.body, body.base64Encoded))
    }
    session.finishRequest(slRequestId, 'eof')
  } catch (e) {
    session.finishRequest(
      slRequestId,
      'error',
      e instanceof Error ? e.message : 'CDP getResponseBody failed',
    )
  }
}

function ensureCdpStreamRequest(
  tabId: number,
  session: CaptureSession,
  networkRequestId: string,
  url: string,
  method: string,
  status?: number,
  mime?: string,
): string {
  const existing = networkToSl.get(networkRequestId)
  if (existing) return existing.slId

  const req = session.startRequest({
    id: `cdp_${networkRequestId.replace(/[^a-zA-Z0-9]/g, '_')}`,
    tabId,
    url,
    method,
    status,
    contentType: mime,
    startedAt: Date.now(),
    source: 'cdp',
  })
  networkToSl.set(networkRequestId, { slId: req.id, tabId })
  return req.id
}

let listenerInstalled = false

export function installCdpListener(
  getSession: (tabId: number) => CaptureSession | undefined,
  isCapturing: (tabId: number) => boolean,
): void {
  if (listenerInstalled || !hasDebuggerApi()) return
  listenerInstalled = true

  chrome.debugger.onEvent.addListener((source, method, params) => {
    const tabId = source.tabId
    if (tabId === undefined || !attachedTabs.has(tabId)) return
    if (!isCapturing(tabId)) return
    const session = getSession(tabId)
    if (!session) return

    const { enableCdpMetadata, enableCdpBodyStream } = getSettings()

    if (method === 'Network.responseReceived') {
      const p = params as {
        requestId?: string
        type?: string
        response?: { url?: string; status?: number; mimeType?: string }
      }
      const response = p.response
      if (!response?.url || !p.requestId) return
      const mime = response.mimeType ?? ''
      if (!isStreamMime(mime)) return

      const methodName = p.type === 'Fetch' ? 'POST' : 'GET'
      const injectedId = session.findLatestInjectedRequestForUrl(response.url)

      if (injectedId) {
        session.updateRequestMeta(injectedId, { status: response.status, contentType: mime })
        networkToSl.set(p.requestId, { slId: injectedId, tabId })
        return
      }

      if (enableCdpBodyStream) {
        const slId = ensureCdpStreamRequest(
          tabId,
          session,
          p.requestId,
          response.url,
          methodName,
          response.status,
          mime,
        )
        void pumpStreamResource(tabId, p.requestId, slId, session)
        return
      }

      if (enableCdpMetadata) {
        session.startCdpMetadataRequest(response.url, methodName, response.status, mime)
      }
      return
    }

    if (method === 'Network.loadingFinished' && enableCdpBodyStream) {
      const p = params as { requestId?: string }
      if (!p.requestId) return
      const mapped = networkToSl.get(p.requestId)
      if (!mapped || pumping.has(pumpKey(tabId, p.requestId))) return
      const slId = mapped.slId
      const rt = session.getRequests().find((r) => r.id === slId)
      if (rt && rt.state !== 'pending' && rt.state !== 'streaming') return
      void fallbackGetResponseBody(tabId, p.requestId, slId, session)
    }
  })

  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId !== undefined) attachedTabs.delete(source.tabId)
  })
}
