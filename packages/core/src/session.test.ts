import { describe, expect, it } from 'vitest'
import { CaptureSession, computeMetrics } from './session.js'

describe('CaptureSession', () => {
  it('tracks fetch stream chunks into events', () => {
    const s = new CaptureSession(1, 'sess_test')
    const req = s.startRequest({
      id: 'r1',
      tabId: 1,
      url: 'http://localhost/stream',
      method: 'GET',
      startedAt: Date.now(),
      source: 'fetch-stream',
    })
    s.pushChunk(req.id, 'data: {"x":1}\n\n')
    s.finishRequest(req.id, 'eof')
    const events = s.getEvents(req.id)
    expect(events).toHaveLength(1)
    expect(events[0].parsedData).toEqual({ x: 1 })
    expect(s.getRequests()[0].state).toBe('completed')
  })

  it('ends stream on [DONE] marker', () => {
    const s = new CaptureSession(1, 'sess_done')
    const req = s.startRequest({
      id: 'r2',
      tabId: 1,
      url: 'http://localhost/api/sse',
      method: 'GET',
      startedAt: Date.now(),
      source: 'fetch-stream',
    })
    s.pushChunk(req.id, 'data: [DONE]\n\n')
    expect(s.getRequests()[0].state).toBe('completed')
    expect(s.getEvents(req.id).some((e) => e.streamEndMarker)).toBe(true)
  })

  it('finishes all open requests and flushes buffered events', () => {
    const s = new CaptureSession(1, 'sess_abort')
    const open = s.startRequest({
      id: 'open',
      tabId: 1,
      url: 'http://localhost/stream',
      method: 'GET',
      startedAt: Date.now(),
      source: 'fetch-stream',
    })
    const closed = s.startRequest({
      id: 'closed',
      tabId: 1,
      url: 'http://localhost/closed',
      method: 'GET',
      startedAt: Date.now(),
      source: 'fetch-stream',
    })
    s.finishRequest(closed.id, 'eof')
    s.pushChunk(open.id, 'data: {"a":1}\n\n')
    s.pushChunk(open.id, 'data: {"tail":true}')

    s.finishOpenRequests('abort', 'Page navigation/reload')

    const requests = s.getRequests()
    const finishedOpen = requests.find((r) => r.id === open.id)!
    expect(finishedOpen.state).toBe('aborted')
    expect(finishedOpen.finishReason).toBe('abort')
    expect(finishedOpen.errorMessage).toBe('Page navigation/reload')
    expect(s.getEvents(open.id).map((e) => e.data)).toEqual(['{"a":1}', '{"tail":true}'])
    expect(requests.find((r) => r.id === closed.id)!.state).toBe('completed')
  })

  it('restores a persisted sessionId and finishes stale requests', () => {
    const s = new CaptureSession(7, 'sess_restored')
    s.replaceState(
      [
        {
          id: 'r1',
          tabId: 7,
          url: 'http://localhost/sse',
          method: 'GET',
          startedAt: 1000,
          state: 'streaming',
          source: 'fetch-stream',
          eventCount: 1,
          parseErrorCount: 0,
        },
      ],
      {
        r1: [
          {
            id: 'e1',
            requestId: 'r1',
            index: 0,
            timestamp: 1100,
            data: '{"a":1}',
          },
        ],
      },
    )
    expect(s.sessionId).toBe('sess_restored')
    expect(s.getEvents('r1')).toHaveLength(1)
    s.finishOpenRequests('abort', 'Service worker restarted')
    expect(s.getRequests()[0].state).toBe('aborted')
  })

  it('computes metrics', () => {
    const startedAt = 1000
    const request = {
      id: 'r1',
      tabId: 1,
      url: 'u',
      method: 'GET',
      startedAt,
      firstEventAt: 1500,
      endedAt: 3000,
      state: 'completed' as const,
      source: 'fetch-stream' as const,
      eventCount: 1,
      parseErrorCount: 0,
    }
    const m = computeMetrics(request, [])
    expect(m.firstEventLatencyMs).toBe(500)
    expect(m.totalDurationMs).toBe(2000)
  })
})
