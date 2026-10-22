export type RequestState = 'pending' | 'streaming' | 'completed' | 'failed' | 'aborted'

export type RequestSource = 'fetch-stream' | 'event-source' | 'cdp'

export interface StreamRequest {
  id: string
  tabId: number
  url: string
  method: string
  status?: number
  contentType?: string
  startedAt: number
  firstEventAt?: number
  endedAt?: number
  state: RequestState
  source: RequestSource
  eventCount: number
  parseErrorCount: number
  finishReason?: 'eof' | 'error' | 'abort' | 'closed'
  errorMessage?: string
}

export interface StreamEvent {
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
  /** AI / vendor adapter id when normalization applied */
  adapterId?: string
  normalizedData?: unknown
  /** Protocol-level stream terminator (e.g. `[DONE]`), not a standard SSE field */
  streamEndMarker?: boolean
}

export type FinishReason = 'eof' | 'error' | 'abort' | 'closed'

export type StreamLensMessage =
  | {
      type: 'CAPTURE_START'
      sessionId: string
      tabId: number
    }
  | {
      type: 'CAPTURE_STOP'
      sessionId: string
    }
  | {
      type: 'REQUEST_STARTED'
      sessionId: string
      request: StreamRequest
    }
  | {
      type: 'REQUEST_META'
      sessionId: string
      requestId: string
      status?: number
      contentType?: string
    }
  | {
      type: 'SSE_CHUNK'
      sessionId: string
      requestId: string
      chunk: string
    }
  | {
      type: 'SSE_EVENT'
      sessionId: string
      event: StreamEvent
    }
  | {
      type: 'REQUEST_FINISHED'
      sessionId: string
      requestId: string
      reason: FinishReason
      errorMessage?: string
    }
  | {
      type: 'CAPTURE_STATE'
      sessionId: string
      capturing: boolean
      error?: string
    }

export const STREAMLENS_BRIDGE_SOURCE = 'streamlens-bridge' as const
export const STREAMLENS_PAGE_SOURCE = 'streamlens-page' as const

export type { StreamLensLimits } from './limits.js'
export { DEFAULT_LIMITS } from './limits.js'

export type { StreamLensSettings } from './settings.js'
export {
  CAPTURE_STATE_STORAGE_PREFIX,
  DEFAULT_SETTINGS,
  SESSION_STORAGE_PREFIX,
  SETTINGS_STORAGE_KEY,
} from './settings.js'
