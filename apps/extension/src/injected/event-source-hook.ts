import { STREAMLENS_PAGE_SOURCE } from '@streamlens/protocol'
import { getInjectedSessionId } from './session-id'

function newRequestId(): string {
  return `es_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function post(msg: Record<string, unknown>): void {
  window.postMessage({ source: STREAMLENS_PAGE_SOURCE, ...msg }, '*')
}

interface SlMeta {
  sessionId: string
  requestId: string
  finished: boolean
  wiredTypes: Set<string>
}

const metaByEs = new WeakMap<EventSource, SlMeta>()
let prototypeHookInstalled = false

function installPrototypeHook(Original: typeof EventSource): void {
  if (prototypeHookInstalled) return
  prototypeHookInstalled = true
  const origAdd = Original.prototype.addEventListener
  // @ts-expect-error capture hook preserves native EventSource typings
  Original.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (listener) origAdd.call(this, type, listener, options)
    const meta = metaByEs.get(this)
    if (!meta || meta.finished) return
    if (type === 'open' || type === 'error' || type === 'message') return
    if (meta.wiredTypes.has(type)) return
    meta.wiredTypes.add(type)
    origAdd.call(this, type, (ev: Event) => {
      if (!(ev instanceof MessageEvent)) return
      post({
        sessionId: meta.sessionId,
        type: 'ES_EVENT',
        requestId: meta.requestId,
        data: String(ev.data ?? ''),
        eventType: type,
        eventId: ev.lastEventId || undefined,
      })
    })
  }
}

export function installEventSourceHook(): void {
  const Original = window.EventSource
  installPrototypeHook(Original)

  class PatchedEventSource extends Original {
    constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
      super(url, eventSourceInitDict)
      const sessionId = getInjectedSessionId()
      if (!sessionId) return
      const requestId = newRequestId()
      const meta: SlMeta = {
        sessionId,
        requestId,
        finished: false,
        wiredTypes: new Set(),
      }
      metaByEs.set(this, meta)

      post({
        sessionId,
        type: 'REQUEST_STARTED',
        requestId,
        url: String(url),
        method: 'GET',
        requestSource: 'event-source',
        contentType: 'text/event-stream',
        startedAt: Date.now(),
      })

      this.addEventListener('open', () => {
        post({
          sessionId,
          type: 'REQUEST_META',
          requestId,
          status: 200,
          contentType: 'text/event-stream',
        })
      })

      this.addEventListener('message', (ev: Event) => {
        const m = metaByEs.get(this)
        if (!m || m.finished) return
        const me = ev as MessageEvent
        post({
          sessionId: m.sessionId,
          type: 'ES_EVENT',
          requestId: m.requestId,
          data: String(me.data ?? ''),
          eventType: 'message',
        })
      })

      this.addEventListener('error', () => {
        const m = metaByEs.get(this)
        if (!m || m.finished) return
        m.finished = true
        if (this.readyState === Original.CLOSED) {
          post({
            sessionId: m.sessionId,
            type: 'REQUEST_FINISHED',
            requestId: m.requestId,
            reason: 'closed',
          })
        } else {
          post({
            sessionId: m.sessionId,
            type: 'REQUEST_FINISHED',
            requestId: m.requestId,
            reason: 'error',
            errorMessage: 'EventSource error',
          })
        }
      })
    }
  }

  window.EventSource = PatchedEventSource as typeof EventSource
}
