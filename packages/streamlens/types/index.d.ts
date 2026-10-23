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
  /** Corner where the launcher and panel are anchored. Default: 'bottom-right' */
  position?: StreamLensPosition
  /** 'auto' follows the OS color scheme. Default: 'auto' */
  theme?: StreamLensTheme
  /** Normalize OpenAI-style `chat/completions` chunks. Default: true */
  enableAiAdapter?: boolean
  /** Redact tokens and sensitive fields in export payloads. Default: true */
  redactOnExport?: boolean
  limits?: StreamLensLimits
  /** Host element z-index. Default: 2147483647 */
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
  /** Resume capturing stream responses. */
  start(): void
  /** Pause capturing; in-flight requests are marked as aborted. */
  stop(): void
  /** Drop all captured requests and events. */
  clear(): void
  open(): void
  close(): void
  isCapturing(): boolean
  getRequests(): CapturedRequest[]
  getEvents(requestId: string): CapturedEvent[]
  /** Redacted (by default) records for every captured request. */
  exportJson(): StreamLensExportRecord[]
  /** HAR 1.2 file with a `_streamlens` extension block. */
  exportHar(): unknown
  /** Unmount the panel, restore fetch / EventSource, and stop capturing. */
  destroy(): void
}

export declare function installStreamLens(options?: StreamLensOptions): StreamLensInstance
export declare function getStreamLens(): StreamLensInstance | undefined
export declare const VERSION: string
