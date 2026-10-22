import { describe, expect, it } from 'vitest'
import { isValidBridgePayload } from './message-guard'

describe('isValidBridgePayload', () => {
  it('accepts valid REQUEST_STARTED', () => {
    expect(
      isValidBridgePayload({
        sessionId: 's1',
        type: 'REQUEST_STARTED',
        requestId: 'r1',
        url: 'http://localhost/x',
        method: 'GET',
        startedAt: 1,
        requestSource: 'fetch-stream',
      }),
    ).toBe(true)
  })

  it('rejects oversized url', () => {
    expect(
      isValidBridgePayload({
        sessionId: 's1',
        type: 'REQUEST_STARTED',
        requestId: 'r1',
        url: 'http://x/' + 'a'.repeat(9000),
        method: 'GET',
        startedAt: 1,
        requestSource: 'fetch-stream',
      }),
    ).toBe(false)
  })
})
