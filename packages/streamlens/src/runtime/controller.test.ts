import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptureController } from './controller.js'

function createController(): CaptureController {
  return new CaptureController({
    limits: { maxRequests: 10, maxEventsPerRequest: 100, maxEventDataChars: 10_000 },
  })
}

describe('CaptureController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('batches session updates into a stable snapshot', () => {
    const controller = createController()
    controller.start()
    controller.startRequest({
      id: 'req_1',
      url: 'https://example.com/sse',
      method: 'GET',
      status: 200,
      contentType: 'text/event-stream',
      startedAt: Date.now(),
      source: 'fetch-stream',
    })
    controller.pushChunk('req_1', 'data: {"a":1}\n\n')

    expect(controller.getSnapshot().requests).toHaveLength(0)
    vi.advanceTimersByTime(50)

    const snapshot = controller.getSnapshot()
    expect(snapshot.capturing).toBe(true)
    expect(snapshot.requests).toHaveLength(1)
    expect(snapshot.requests[0].state).toBe('streaming')
    expect(snapshot.eventsByRequest.req_1).toHaveLength(1)
    expect(snapshot.eventsByRequest.req_1[0].parsedData).toEqual({ a: 1 })

    controller.finishRequest('req_1', 'eof')
    vi.advanceTimersByTime(50)
    expect(controller.getSnapshot().requests[0].state).toBe('completed')
    controller.destroy()
  })

  it('finishes open requests when capture stops', () => {
    const controller = createController()
    controller.start()
    controller.startRequest({
      id: 'req_1',
      url: 'https://example.com/sse',
      method: 'GET',
      startedAt: Date.now(),
      source: 'fetch-stream',
    })
    controller.stop()

    const snapshot = controller.getSnapshot()
    expect(snapshot.capturing).toBe(false)
    expect(snapshot.requests[0].state).toBe('aborted')
    controller.destroy()
  })

  it('clears requests and events immediately', () => {
    const controller = createController()
    controller.start()
    controller.startRequest({
      id: 'req_1',
      url: 'https://example.com/sse',
      method: 'GET',
      startedAt: Date.now(),
      source: 'fetch-stream',
    })
    vi.advanceTimersByTime(50)
    expect(controller.getSnapshot().requests).toHaveLength(1)

    controller.clear()
    const snapshot = controller.getSnapshot()
    expect(snapshot.requests).toHaveLength(0)
    expect(snapshot.eventsByRequest).toEqual({})
    controller.destroy()
  })

  it('notifies subscribers only for applied changes', () => {
    const controller = createController()
    const listener = vi.fn()
    controller.subscribe(listener)

    controller.start()
    expect(listener).toHaveBeenCalledTimes(1)

    controller.startRequest({
      id: 'req_1',
      url: 'https://example.com/sse',
      method: 'GET',
      startedAt: Date.now(),
      source: 'event-source',
    })
    expect(listener).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(50)
    expect(listener).toHaveBeenCalledTimes(2)
    controller.destroy()
  })
})
