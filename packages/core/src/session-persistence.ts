import type { StreamEvent, StreamRequest } from '@streamlens/protocol'

export interface SessionSnapshot {
  version: 1
  sessionId: string
  tabId: number
  savedAt: number
  requests: StreamRequest[]
  eventsByRequest: Record<string, StreamEvent[]>
}

export function createSessionSnapshot(
  sessionId: string,
  tabId: number,
  requests: StreamRequest[],
  eventsByRequest: Record<string, StreamEvent[]>,
): SessionSnapshot {
  return {
    version: 1,
    sessionId,
    tabId,
    savedAt: Date.now(),
    requests: requests.map((r) => ({ ...r })),
    eventsByRequest: Object.fromEntries(
      Object.entries(eventsByRequest).map(([k, v]) => [k, v.map((e) => ({ ...e }))]),
    ),
  }
}

export function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const o = value as SessionSnapshot
  return o.version === 1 && typeof o.sessionId === 'string' && Array.isArray(o.requests)
}
