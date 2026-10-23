export type StreamLensPosition = 'bottom-right' | 'bottom-left'
export type StreamLensTheme = 'auto' | 'light' | 'dark'

export interface StreamLensLimits {
  maxEventDataChars?: number
  maxEventsPerRequest?: number
  maxRequests?: number
}

export interface StreamLensOptions {
  /** Capture starts as soon as the panel is installed. Default: true */
  autoStart?: boolean
  /** Open the panel immediately instead of showing the launcher. Default: false */
  open?: boolean
  position?: StreamLensPosition
  theme?: StreamLensTheme
  enableAiAdapter?: boolean
  redactOnExport?: boolean
  limits?: StreamLensLimits
  zIndex?: number
}

export type CapturedRequestState = 'pending' | 'streaming' | 'completed' | 'failed' | 'aborted'
export type CapturedRequestSource = 'fetch-stream' | 'event-source' | 'cdp'

export interface CapturedRequest {
  id: string
  url: string
  method: string
  status?: number
  contentType?: string
  startedAt: number
  firstEventAt?: number
  endedAt?: number
  state: CapturedRequestState
  source: CapturedRequestSource
  eventCount: number
  parseErrorCount: number
  finishReason?: 'eof' | 'error' | 'abort' | 'closed'
  errorMessage?: string
}

export interface CapturedEvent {
  id: string
  requestId: string
  index: number
  timestamp: number
  eventType?: string
  eventId?: string
  retry?: number
  data: string
  parsedData?: unknown
  parseError?: string
  truncated?: boolean
  adapterId?: string
  normalizedData?: unknown
  streamEndMarker?: boolean
}

export interface CapturedMetrics {
  firstEventLatencyMs?: number
  totalDurationMs?: number
  eventCount: number
  parseErrorCount: number
  avgEventIntervalMs?: number
  maxEventIntervalMs?: number
}

export interface StreamLensExportRecord {
  request: CapturedRequest
  events: CapturedEvent[]
  metrics: CapturedMetrics
}

export interface StreamLensInstance {
  readonly version: string
  start(): void
  stop(): void
  clear(): void
  open(): void
  close(): void
  isCapturing(): boolean
  getRequests(): CapturedRequest[]
  getEvents(requestId: string): CapturedEvent[]
  exportJson(): StreamLensExportRecord[]
  exportHar(): unknown
  destroy(): void
}
