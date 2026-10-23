import { CaptureSession, exportRecordsToHar } from '@streamlens/core'
import type { SessionUpdate } from '@streamlens/core'
import { DEFAULT_LIMITS } from '@streamlens/protocol'
import type {
  FinishReason,
  StreamEvent,
  StreamLensLimits,
  StreamRequest,
} from '@streamlens/protocol'
import type { StreamLensOptions } from '../types.js'
import { VERSION } from '../version.js'

export interface CaptureSnapshot {
  capturing: boolean
  requests: StreamRequest[]
  eventsByRequest: Record<string, StreamEvent[]>
}

interface StartRequestInput {
  id: string
  url: string
  method: string
  status?: number
  contentType?: string
  startedAt: number
  source: 'fetch-stream' | 'event-source'
}

const FLUSH_INTERVAL_MS = 50

export class CaptureController {
  private readonly session: CaptureSession
  private capturing = false
  private pending: SessionUpdate[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly requests = new Map<string, StreamRequest>()
  private readonly events = new Map<string, StreamEvent[]>()
  private readonly knownIds = new Set<string>()
  private order: string[] = []
  private dirty = new Set<string>()
  private resetEvents = false
  private listeners = new Set<() => void>()
  private snapshot: CaptureSnapshot = {
    capturing: false,
    requests: [],
    eventsByRequest: {},
  }

  constructor(options: StreamLensOptions) {
    const limits: StreamLensLimits = { ...DEFAULT_LIMITS, ...options.limits }
    this.session = new CaptureSession(0, undefined, {
      limits,
      enableAiAdapter: options.enableAiAdapter ?? true,
      redactOnExport: options.redactOnExport ?? true,
    })
    this.session.on((update) => this.enqueue(update))
  }

  isCapturing(): boolean {
    return this.capturing
  }

  getSessionId(): string {
    return this.session.sessionId
  }

  start(): void {
    if (this.capturing) return
    this.capturing = true
    this.publish()
  }

  stop(): void {
    if (!this.capturing) return
    this.capturing = false
    this.session.finishOpenRequests('abort', 'Capture stopped')
    this.flush()
    this.publish()
  }

  clear(): void {
    this.session.clear()
    this.pending = []
    this.reset()
    this.publish()
  }

  configure(options: { enableAiAdapter?: boolean; redactOnExport?: boolean }): void {
    this.session.configure(options)
  }

  newRequestId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
  }

  startRequest(input: StartRequestInput): void {
    this.session.startRequest({ ...input, tabId: 0 })
  }

  updateRequestMeta(
    requestId: string,
    meta: { status?: number; contentType?: string },
  ): void {
    this.session.updateRequestMeta(requestId, meta)
  }

  pushChunk(requestId: string, chunk: string): void {
    this.session.pushChunk(requestId, chunk)
  }

  finishRequest(requestId: string, reason: FinishReason, errorMessage?: string): void {
    this.session.finishRequest(requestId, reason, errorMessage)
  }

  appendEventSourceMessage(
    requestId: string,
    payload: { data: string; eventType?: string; eventId?: string },
  ): void {
    this.session.appendEventSourceMessage(requestId, payload)
  }

  getSnapshot(): CaptureSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getRequests(): StreamRequest[] {
    return this.session.getRequests()
  }

  getEvents(requestId: string): StreamEvent[] {
    return this.session.getEvents(requestId)
  }

  exportJson() {
    return this.session.exportAll()
  }

  exportRequest(requestId: string) {
    return this.session.exportRequest(requestId)
  }

  exportHar() {
    return exportRecordsToHar(this.session.exportAll(), { creatorVersion: VERSION })
  }

  exportRequestHar(requestId: string) {
    const record = this.session.exportRequest(requestId)
    if (!record) return null
    return exportRecordsToHar([record], { creatorVersion: VERSION })
  }

  destroy(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.pending = []
    this.listeners.clear()
  }

  private enqueue(update: SessionUpdate): void {
    this.pending.push(update)
    if (this.flushTimer !== null) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
    }, FLUSH_INTERVAL_MS)
  }

  private flush(): void {
    if (!this.pending.length) return
    const updates = this.pending
    this.pending = []
    let changed = false
    for (const update of updates) {
      if (this.apply(update)) changed = true
    }
    if (changed) this.publish()
  }

  private apply(update: SessionUpdate): boolean {
    if (update.kind === 'cleared') {
      this.reset()
      return true
    }

    if (update.kind === 'request') {
      const request = update.request
      if (!this.knownIds.has(request.id)) {
        this.knownIds.add(request.id)
        this.order.unshift(request.id)
      }
      this.requests.set(request.id, request)
      return true
    }

    const event = update.event
    let list = this.events.get(event.requestId)
    if (!list) {
      list = []
      this.events.set(event.requestId, list)
    }
    const last = list[list.length - 1]
    if (last && last.id === event.id) {
      list[list.length - 1] = event
    } else {
      const index = list.findIndex((item) => item.id === event.id)
      if (index >= 0) list[index] = event
      else list.push(event)
    }
    this.dirty.add(event.requestId)
    return true
  }

  private reset(): void {
    this.requests.clear()
    this.events.clear()
    this.knownIds.clear()
    this.order = []
    this.dirty.clear()
    this.resetEvents = true
  }

  private publish(): void {
    const eventsByRequest: Record<string, StreamEvent[]> = this.resetEvents
      ? {}
      : { ...this.snapshot.eventsByRequest }
    this.resetEvents = false
    for (const requestId of this.dirty) {
      const list = this.events.get(requestId)
      eventsByRequest[requestId] = list ? list.slice() : []
    }
    this.dirty.clear()

    const requests = this.order
      .map((id) => this.requests.get(id))
      .filter((request): request is StreamRequest => Boolean(request))

    this.snapshot = {
      capturing: this.capturing,
      requests,
      eventsByRequest,
    }
    for (const listener of this.listeners) listener()
  }
}
