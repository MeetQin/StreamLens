import type { FinishReason, RequestSource } from '@streamlens/protocol'

const FINISH_REASONS = new Set<FinishReason>(['eof', 'error', 'abort', 'closed'])
const SOURCES = new Set<RequestSource>(['fetch-stream', 'event-source', 'cdp'])

export function isValidBridgePayload(message: Record<string, unknown>): boolean {
  if (typeof message.sessionId !== 'string' || message.sessionId.length > 128) return false
  if (typeof message.type !== 'string') return false

  switch (message.type) {
    case 'REQUEST_STARTED':
      return (
        typeof message.requestId === 'string' &&
        typeof message.url === 'string' &&
        message.url.length <= 8192 &&
        typeof message.method === 'string' &&
        typeof message.startedAt === 'number' &&
        SOURCES.has(message.requestSource as RequestSource)
      )
    case 'REQUEST_META':
      return typeof message.requestId === 'string'
    case 'SSE_CHUNK':
      return typeof message.requestId === 'string' && typeof message.chunk === 'string'
    case 'ES_EVENT':
      return typeof message.requestId === 'string' && typeof message.data === 'string'
    case 'REQUEST_FINISHED':
      return (
        typeof message.requestId === 'string' &&
        FINISH_REASONS.has(message.reason as FinishReason)
      )
    case 'PING':
      return true
    default:
      return false
  }
}
