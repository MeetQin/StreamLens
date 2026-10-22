import type { FinishReason, RequestSource } from '@streamlens/protocol'
import { STREAMLENS_PAGE_SOURCE } from '@streamlens/protocol'

export type PageToBridgeMessage =
  | {
      source: typeof STREAMLENS_PAGE_SOURCE
      sessionId: string
      type: 'REQUEST_STARTED'
      requestId: string
      url: string
      method: string
      requestSource: RequestSource
      contentType?: string
      startedAt: number
    }
  | {
      source: typeof STREAMLENS_PAGE_SOURCE
      sessionId: string
      type: 'REQUEST_META'
      requestId: string
      status?: number
      contentType?: string
    }
  | {
      source: typeof STREAMLENS_PAGE_SOURCE
      sessionId: string
      type: 'SSE_CHUNK'
      requestId: string
      chunk: string
    }
  | {
      source: typeof STREAMLENS_PAGE_SOURCE
      sessionId: string
      type: 'ES_EVENT'
      requestId: string
      data: string
      eventType?: string
      eventId?: string
    }
  | {
      source: typeof STREAMLENS_PAGE_SOURCE
      sessionId: string
      type: 'REQUEST_FINISHED'
      requestId: string
      reason: FinishReason
      errorMessage?: string
    }
  | {
      source: typeof STREAMLENS_PAGE_SOURCE
      sessionId: string
      type: 'PING'
    }

export function isPageMessage(data: unknown): data is PageToBridgeMessage {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return o.source === STREAMLENS_PAGE_SOURCE && typeof o.sessionId === 'string'
}

export function postToPage(message: Record<string, unknown>): void {
  window.postMessage(message, '*')
}
