import { applyAiAdapters } from '@streamlens/adapters-ai-stream'
import type {
  FinishReason,
  StreamEvent,
  StreamLensLimits,
  StreamRequest,
} from '@streamlens/protocol'
import { DEFAULT_LIMITS } from '@streamlens/protocol'
import { SseParser, enrichWithJson } from '@streamlens/sse-parser'
import {
  redactSensitiveInText,
  redactSensitiveInUrl,
  redactUnknown,
  truncateText,
} from './sanitize.js'

export type SessionListener = (update: SessionUpdate) => void

export type SessionUpdate =
  | { kind: 'request'; request: StreamRequest }
  | { kind: 'event'; event: StreamEvent }
  | { kind: 'cleared' }

export interface CaptureSessionOptions {
  limits?: StreamLensLimits
  /** Apply OpenAI-style and generic `[DONE]` adapters */
  enableAiAdapter?: boolean
  /** Redact sensitive fields in export payloads */
  redactOnExport?: boolean
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

interface RequestRuntime {
  request: StreamRequest
  parser: SseParser
  eventIndex: number
  finished: boolean
}

export class CaptureSession {
  readonly sessionId: string
  readonly tabId: number
  private limits: StreamLensLimits
  private enableAiAdapter: boolean
  private redactOnExport: boolean
  private requests = new Map<string, RequestRuntime>()
  private requestOrder: string[] = []
  private events = new Map<string, StreamEvent[]>()
  private listeners = new Set<SessionListener>()

  constructor(tabId: number, sessionId?: string, options: CaptureSessionOptions = {}) {
    this.tabId = tabId
    this.sessionId = sessionId ?? newId('sess')
    this.limits = options.limits ?? DEFAULT_LIMITS
    this.enableAiAdapter = options.enableAiAdapter ?? true
    this.redactOnExport = options.redactOnExport ?? true
  }

  configure(options: Partial<CaptureSessionOptions>): void {
    if (options.limits) this.limits = options.limits
    if (options.enableAiAdapter !== undefined) this.enableAiAdapter = options.enableAiAdapter
    if (options.redactOnExport !== undefined) this.redactOnExport = options.redactOnExport
  }

  on(listener: SessionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getRequests(): StreamRequest[] {
    return this.requestOrder.map((id) => this.requests.get(id)!.request)
  }

  getEvents(requestId: string): StreamEvent[] {
    return this.events.get(requestId) ?? []
  }

  clear(): void {
    this.requests.clear()
    this.requestOrder = []
    this.events.clear()
    this.emit({ kind: 'cleared' })
  }

  /** Replace in-memory state (e.g. after loading persisted snapshot). Does not emit updates. */
  replaceState(requests: StreamRequest[], eventsByRequest: Record<string, StreamEvent[]>): void {
    this.requests.clear()
    this.requestOrder = []
    this.events.clear()
    for (const req of requests) {
      const events = eventsByRequest[req.id] ?? []
      const finished = req.state !== 'pending' && req.state !== 'streaming'
      this.requests.set(req.id, {
        request: { ...req, tabId: this.tabId },
        parser: new SseParser(),
        eventIndex: events.length,
        finished,
      })
      this.requestOrder.push(req.id)
      this.events.set(
        req.id,
        events.map((e) => ({ ...e })),
      )
    }
  }

  /** Match injected request for CDP metadata enrichment */
  findLatestRequestForUrl(url: string): string | undefined {
    let found: string | undefined
    for (let i = this.requestOrder.length - 1; i >= 0; i--) {
      const id = this.requestOrder[i]
      const rt = this.requests.get(id)
      if (!rt) continue
      if (rt.request.url === url) return id
      if (!found && rt.request.url.split('?')[0] === url.split('?')[0]) found = id
    }
    return found
  }

  /** Prefer page-injected capture when CDP also sees the same URL */
  findLatestInjectedRequestForUrl(url: string): string | undefined {
    for (let i = this.requestOrder.length - 1; i >= 0; i--) {
      const id = this.requestOrder[i]
      const rt = this.requests.get(id)
      if (!rt) continue
      if (rt.request.source !== 'fetch-stream' && rt.request.source !== 'event-source') continue
      if (rt.request.url === url) return id
      if (rt.request.url.split('?')[0] === url.split('?')[0]) return id
    }
    return undefined
  }

  startCdpMetadataRequest(
    url: string,
    method: string,
    status?: number,
    contentType?: string,
  ): StreamRequest {
    const startedAt = Date.now()
    const req = this.startRequest({
      id: newId('cdp'),
      tabId: this.tabId,
      url,
      method,
      status,
      contentType,
      startedAt,
      source: 'cdp',
    })
    this.finishRequest(req.id, 'closed', 'CDP metadata only — response body not captured via CDP')
    return this.requests.get(req.id)!.request
  }

  startRequest(
    partial: Omit<StreamRequest, 'eventCount' | 'parseErrorCount' | 'state'> & {
      state?: StreamRequest['state']
    },
  ): StreamRequest {
    if (this.requestOrder.length >= this.limits.maxRequests) {
      const oldest = this.requestOrder.shift()
      if (oldest) {
        this.requests.delete(oldest)
        this.events.delete(oldest)
      }
    }
    const request: StreamRequest = {
      ...partial,
      tabId: this.tabId,
      state: partial.state ?? 'pending',
      eventCount: 0,
      parseErrorCount: 0,
    }
    this.requests.set(request.id, {
      request,
      parser: new SseParser(),
      eventIndex: 0,
      finished: false,
    })
    this.requestOrder.push(request.id)
    this.events.set(request.id, [])
    this.emit({ kind: 'request', request: { ...request } })
    return request
  }

  updateRequestMeta(requestId: string, meta: { status?: number; contentType?: string }): void {
    const rt = this.requests.get(requestId)
    if (!rt || rt.finished) return
    if (meta.status !== undefined) rt.request.status = meta.status
    if (meta.contentType !== undefined) rt.request.contentType = meta.contentType
    if (rt.request.state === 'pending') rt.request.state = 'streaming'
    this.emit({ kind: 'request', request: { ...rt.request } })
  }

  pushChunk(requestId: string, chunk: string): void {
    const rt = this.requests.get(requestId)
    if (!rt || rt.finished) return
    rt.request.state = 'streaming'
    const parsed = rt.parser.push(chunk)
    for (const raw of parsed) {
      if (this.appendEvent(rt, raw)) break
    }
    if (!rt.finished) {
      this.emit({ kind: 'request', request: { ...rt.request } })
    }
  }

  appendEventSourceMessage(
    requestId: string,
    payload: { data: string; eventType?: string; eventId?: string },
  ): void {
    const rt = this.requests.get(requestId)
    if (!rt || rt.finished) return
    rt.request.state = 'streaming'
    this.appendEvent(rt, {
      data: payload.data,
      event: payload.eventType,
      id: payload.eventId,
    })
    if (!rt.finished) {
      this.emit({ kind: 'request', request: { ...rt.request } })
    }
  }

  finishRequest(requestId: string, reason: FinishReason, errorMessage?: string): void {
    const rt = this.requests.get(requestId)
    if (!rt || rt.finished) return
    const tail = rt.parser.flush()
    for (const raw of tail) {
      if (this.appendEvent(rt, raw)) break
    }
    this.markFinished(rt, reason, errorMessage)
  }

  /** Finish every in-flight request, e.g. on stop or page navigation. */
  finishOpenRequests(reason: FinishReason, errorMessage?: string): void {
    for (const rt of this.requests.values()) {
      if (rt.finished) continue
      const tail = rt.parser.flush()
      for (const raw of tail) {
        if (this.appendEvent(rt, raw)) break
      }
      this.markFinished(rt, reason, errorMessage)
    }
  }

  exportRequest(requestId: string): {
    request: StreamRequest
    events: StreamEvent[]
    metrics: ReturnType<typeof computeMetrics>
  } | null {
    const rt = this.requests.get(requestId)
    if (!rt) return null
    const rawEvents = this.events.get(requestId) ?? []
    const events = this.redactOnExport ? rawEvents.map(redactEventForExport) : [...rawEvents]
    return {
      request: {
        ...rt.request,
        url: this.redactOnExport ? redactSensitiveInUrl(rt.request.url) : rt.request.url,
      },
      events,
      metrics: computeMetrics(rt.request, this.events.get(requestId) ?? []),
    }
  }

  exportAll(): Array<{
    request: StreamRequest
    events: StreamEvent[]
    metrics: ReturnType<typeof computeMetrics>
  }> {
    return this.requestOrder
      .map((id) => this.exportRequest(id))
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }

  /** @returns true if stream ended and caller should stop processing */
  private appendEvent(
    rt: RequestRuntime,
    raw: { data: string; event?: string; id?: string; retry?: number },
  ): boolean {
    if (rt.finished) return true
    if (rt.request.eventCount >= this.limits.maxEventsPerRequest) return false

    const enriched = enrichWithJson(raw, true)
    let adapterId: string | undefined
    let normalizedData: unknown
    let streamEndMarker = false

    if (this.enableAiAdapter) {
      const adapterResult = applyAiAdapters(
        rt.request.url,
        rt.request.contentType,
        enriched.data,
        enriched.parsedData,
      )
      if (adapterResult?.streamEnd) {
        streamEndMarker = true
        adapterId = adapterResult.adapterId
        normalizedData = adapterResult.normalized
        this.emitStreamEndMarker(rt, enriched, adapterId, normalizedData)
        this.markFinished(rt, 'eof')
        return true
      }
      if (adapterResult) {
        adapterId = adapterResult.adapterId
        normalizedData = adapterResult.normalized
        if (adapterResult.parseError) {
          rt.request.parseErrorCount += 1
        }
      }
    } else if (enriched.data.trim() === '[DONE]') {
      streamEndMarker = true
      this.emitStreamEndMarker(rt, enriched, 'generic-done-marker', { done: true })
      this.markFinished(rt, 'eof')
      return true
    }

    const { text, truncated } = truncateText(enriched.data, this.limits.maxEventDataChars)

    const event: StreamEvent = {
      id: newId('evt'),
      requestId: rt.request.id,
      index: rt.eventIndex++,
      timestamp: Date.now(),
      eventType: enriched.event,
      eventId: enriched.id,
      retry: enriched.retry,
      data: text,
      parsedData: enriched.parsedData,
      parseError: enriched.parseError,
      truncated,
      adapterId,
      normalizedData,
      streamEndMarker: streamEndMarker || undefined,
    }

    if (enriched.parseError) {
      rt.request.parseErrorCount += 1
    }

    if (rt.request.firstEventAt === undefined) {
      rt.request.firstEventAt = event.timestamp
    }
    rt.request.eventCount += 1

    const list = this.events.get(rt.request.id)!
    list.push(event)
    this.emit({ kind: 'event', event: { ...event } })
    return false
  }

  private emitStreamEndMarker(
    rt: RequestRuntime,
    enriched: { data: string; event?: string },
    adapterId: string,
    normalizedData: unknown,
  ): void {
    const event: StreamEvent = {
      id: newId('evt'),
      requestId: rt.request.id,
      index: rt.eventIndex++,
      timestamp: Date.now(),
      eventType: enriched.event ?? 'stream-end',
      data: enriched.data.trim() || '[DONE]',
      streamEndMarker: true,
      adapterId,
      normalizedData,
    }
    if (rt.request.firstEventAt === undefined) {
      rt.request.firstEventAt = event.timestamp
    }
    rt.request.eventCount += 1
    this.events.get(rt.request.id)!.push(event)
    this.emit({ kind: 'event', event: { ...event } })
  }

  private markFinished(rt: RequestRuntime, reason: FinishReason, errorMessage?: string): void {
    if (rt.finished) return
    rt.finished = true
    rt.request.endedAt = Date.now()
    rt.request.finishReason = reason
    rt.request.errorMessage = errorMessage
    switch (reason) {
      case 'eof':
      case 'closed':
        rt.request.state = 'completed'
        break
      case 'abort':
        rt.request.state = 'aborted'
        break
      case 'error':
        rt.request.state = 'failed'
        break
    }
    this.emit({ kind: 'request', request: { ...rt.request } })
  }

  private emit(update: SessionUpdate): void {
    for (const l of this.listeners) l(update)
  }
}

function redactEventForExport(event: StreamEvent): StreamEvent {
  return {
    ...event,
    data: redactSensitiveInText(event.data),
    parsedData: event.parsedData !== undefined ? redactUnknown(event.parsedData) : undefined,
    normalizedData:
      event.normalizedData !== undefined ? redactUnknown(event.normalizedData) : undefined,
  }
}

export function computeMetrics(request: StreamRequest, events: StreamEvent[]) {
  const firstEventLatencyMs =
    request.firstEventAt !== undefined ? request.firstEventAt - request.startedAt : undefined
  const totalDurationMs =
    request.endedAt !== undefined ? request.endedAt - request.startedAt : undefined

  const intervals: number[] = []
  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i].timestamp - events[i - 1].timestamp)
  }
  const avgEventIntervalMs =
    intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : undefined
  const maxEventIntervalMs = intervals.length > 0 ? Math.max(...intervals) : undefined

  return {
    firstEventLatencyMs,
    totalDurationMs,
    eventCount: events.length,
    parseErrorCount: request.parseErrorCount,
    avgEventIntervalMs,
    maxEventIntervalMs,
  }
}
