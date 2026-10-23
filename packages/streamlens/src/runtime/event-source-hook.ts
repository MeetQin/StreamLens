import type { CaptureController } from './controller.js'

interface EventSourceMeta {
  requestId: string
  finished: boolean
  wiredTypes: Set<string>
}

export function installEventSourceHook(controller: CaptureController): () => void {
  const Original = window.EventSource
  if (!Original) return () => {}

  type AnyAddEventListener = (
    this: EventSource,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) => void

  const metaBySource = new WeakMap<EventSource, EventSourceMeta>()
  const proto = Original.prototype as unknown as {
    addEventListener: AnyAddEventListener
  }
  const originalAddEventListener = proto.addEventListener

  proto.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (listener) originalAddEventListener.call(this, type, listener, options)
    const meta = metaBySource.get(this)
    if (!meta || meta.finished || listener === null) return
    if (type === 'open' || type === 'error' || type === 'message') return
    if (meta.wiredTypes.has(type)) return
    meta.wiredTypes.add(type)
    originalAddEventListener.call(this, type, (event: Event) => {
      if (!(event instanceof MessageEvent)) return
      controller.appendEventSourceMessage(meta.requestId, {
        data: String(event.data ?? ''),
        eventType: type,
        eventId: event.lastEventId || undefined,
      })
    })
  }

  class StreamLensEventSource extends Original {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, init)
      if (!controller.isCapturing()) return

      const requestId = controller.newRequestId('es')
      const meta: EventSourceMeta = {
        requestId,
        finished: false,
        wiredTypes: new Set(),
      }
      metaBySource.set(this, meta)

      controller.startRequest({
        id: requestId,
        url: String(url),
        method: 'GET',
        contentType: 'text/event-stream',
        startedAt: Date.now(),
        source: 'event-source',
      })

      originalAddEventListener.call(this, 'open', () => {
        controller.updateRequestMeta(requestId, {
          status: 200,
          contentType: 'text/event-stream',
        })
      })

      originalAddEventListener.call(this, 'message', (event: Event) => {
        if (meta.finished) return
        const message = event as MessageEvent
        controller.appendEventSourceMessage(requestId, {
          data: String(message.data ?? ''),
          eventType: 'message',
          eventId: message.lastEventId || undefined,
        })
      })

      originalAddEventListener.call(this, 'error', () => {
        if (meta.finished) return
        meta.finished = true
        if (this.readyState === Original.CLOSED) {
          controller.finishRequest(requestId, 'closed')
        } else {
          controller.finishRequest(requestId, 'error', 'EventSource error')
        }
      })
    }
  }

  window.EventSource = StreamLensEventSource as typeof EventSource

  return () => {
    if (window.EventSource === StreamLensEventSource) window.EventSource = Original
    proto.addEventListener = originalAddEventListener
  }
}
