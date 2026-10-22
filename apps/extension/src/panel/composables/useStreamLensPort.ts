import { computeMetrics } from '@streamlens/core'
import type { SessionUpdate } from '@streamlens/core'
import type { StreamEvent, StreamLensSettings, StreamRequest } from '@streamlens/protocol'
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'

export type CaptureStatus = 'idle' | 'capturing' | 'stopped' | 'error'

export function useStreamLensPort() {
  const tabId = ref<number | null>(null)
  const sessionId = ref('')
  const captureStatus = ref<CaptureStatus>('idle')
  const captureError = ref<string | null>(null)
  const navigationHint = ref<string | null>(null)
  const cdpHint = ref<string | null>(null)
  const requests = shallowRef<StreamRequest[]>([])
  const eventsByRequest = shallowRef<Record<string, StreamEvent[]>>({})
  const settings = ref<StreamLensSettings | null>(null)

  let port: chrome.runtime.Port | null = null
  let disposed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0

  const RECONNECT_BASE_MS = 500
  const RECONNECT_MAX_MS = 5_000

  function applySnapshot(data: {
    capturing: boolean
    sessionId: string
    requests: StreamRequest[]
    eventsByRequest: Record<string, StreamEvent[]>
  }): void {
    sessionId.value = data.sessionId
    captureStatus.value = data.capturing ? 'capturing' : 'stopped'
    requests.value = data.requests
    eventsByRequest.value = data.eventsByRequest
  }

  function applyUpdate(update: SessionUpdate): void {
    if (update.kind === 'cleared') {
      requests.value = []
      eventsByRequest.value = {}
      return
    }
    if (update.kind === 'request') {
      const list = [...requests.value]
      const idx = list.findIndex((r) => r.id === update.request.id)
      if (idx >= 0) list[idx] = update.request
      else list.unshift(update.request)
      requests.value = list
      return
    }
    if (update.kind === 'event') {
      const map = { ...eventsByRequest.value }
      const list = [...(map[update.event.requestId] ?? [])]
      const idx = list.findIndex((e) => e.id === update.event.id)
      if (idx >= 0) list[idx] = update.event
      else list.push(update.event)
      map[update.event.requestId] = list
      eventsByRequest.value = map
    }
  }

  function applyBatch(updates: SessionUpdate[]): void {
    for (const u of updates) applyUpdate(u)
  }

  const pendingExport = ref<((data: unknown) => void) | null>(null)

  function resolvePendingExport(data: unknown): void {
    pendingExport.value?.(data)
    pendingExport.value = null
  }

  function extensionAlive(): boolean {
    try {
      return Boolean(chrome.runtime?.id)
    } catch {
      return false
    }
  }

  function stopReconnect(): void {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function scheduleReconnect(): void {
    if (disposed || reconnectTimer) return
    if (!extensionAlive()) {
      captureStatus.value = 'error'
      captureError.value = '扩展已重新加载，请关闭并重新打开 DevTools'
      resolvePendingExport(null)
      return
    }
    reconnectAttempt += 1
    captureStatus.value = 'error'
    captureError.value = `与后台连接已断开，正在重连（第 ${reconnectAttempt} 次）…`
    resolvePendingExport(null)
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** (reconnectAttempt - 1), RECONNECT_MAX_MS)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect(): void {
    if (disposed) return
    stopReconnect()

    let next: chrome.runtime.Port
    try {
      next = chrome.runtime.connect({ name: 'streamlens-devtools' })
    } catch {
      scheduleReconnect()
      return
    }
    port = next

    next.onMessage.addListener((msg) => {
      if (msg?.type === 'SNAPSHOT') {
        reconnectAttempt = 0
        captureError.value = null
        applySnapshot(msg)
      } else if (msg?.type === 'SESSION_UPDATE') {
        applyUpdate(msg.update)
      } else if (msg?.type === 'SESSION_BATCH') {
        applyBatch(msg.updates)
      } else if (msg?.type === 'CAPTURE_STATE') {
        captureStatus.value = msg.capturing ? 'capturing' : 'stopped'
        sessionId.value = msg.sessionId
        if (msg.reason === 'navigation') {
          navigationHint.value = msg.capturing
            ? '页面已刷新/导航，采集已自动延续。'
            : '页面已导航/刷新，采集已停止。'
        }
      } else if (msg?.type === 'EXPORT_RESULT') {
        resolvePendingExport(msg.data)
      } else if (msg?.type === 'SETTINGS') {
        settings.value = msg.settings
      } else if (msg?.type === 'CDP_STATE' && msg.error) {
        cdpHint.value = String(msg.error)
      }
    })
    next.onDisconnect.addListener(() => {
      if (port === next) port = null
      if (disposed) return
      scheduleReconnect()
    })

    const id = chrome.devtools.inspectedWindow.tabId
    tabId.value = id
    try {
      next.postMessage({ type: 'INIT', tabId: id })
      next.postMessage({ type: 'GET_SETTINGS' })
    } catch {
      /* onDisconnect schedules a retry */
    }
  }

  function startCapture(): void {
    captureError.value = null
    navigationHint.value = null
    port?.postMessage({ type: 'START_CAPTURE' })
  }

  function stopCapture(): void {
    port?.postMessage({ type: 'STOP_CAPTURE' })
  }

  function clearAll(): void {
    port?.postMessage({ type: 'CLEAR' })
  }

  function requestExport(message: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve) => {
      if (!port) {
        resolve(null)
        return
      }
      pendingExport.value = resolve
      try {
        port.postMessage(message)
      } catch {
        resolvePendingExport(null)
      }
    })
  }

  function exportRequest(requestId: string): Promise<unknown> {
    return requestExport({ type: 'EXPORT_REQUEST', requestId })
  }

  function exportAll(): Promise<unknown> {
    return requestExport({ type: 'EXPORT_ALL' })
  }

  function exportHar(): Promise<unknown> {
    return requestExport({ type: 'EXPORT_HAR' })
  }

  function exportRequestHar(requestId: string): Promise<unknown> {
    return requestExport({ type: 'EXPORT_REQUEST_HAR', requestId })
  }

  function getMetrics(request: StreamRequest) {
    return computeMetrics(request, eventsByRequest.value[request.id] ?? [])
  }

  function saveSettings(next: StreamLensSettings): void {
    port?.postMessage({ type: 'SET_SETTINGS', settings: next })
  }

  function getExportPreview(): { requestCount: number; eventCount: number } {
    let eventCount = 0
    for (const r of requests.value) {
      eventCount += eventsByRequest.value[r.id]?.length ?? 0
    }
    return { requestCount: requests.value.length, eventCount }
  }

  onMounted(connect)
  onUnmounted(() => {
    disposed = true
    stopReconnect()
    resolvePendingExport(null)
    port?.disconnect()
    port = null
  })

  return {
    tabId,
    sessionId,
    captureStatus,
    captureError,
    navigationHint,
    cdpHint,
    requests,
    eventsByRequest,
    startCapture,
    stopCapture,
    clearAll,
    exportRequest,
    exportAll,
    exportHar,
    exportRequestHar,
    getMetrics,
    getExportPreview,
    settings,
    saveSettings,
  }
}
