import type { StreamRequest } from '@streamlens/protocol'
import { describe, expect, it } from 'vitest'
import { exportRecordsToHar } from './har-export.js'
import { computeMetrics } from './session.js'

describe('exportRecordsToHar', () => {
  it('builds HAR 1.2 with streamlens extension', () => {
    const request: StreamRequest = {
      id: 'r1',
      tabId: 1,
      url: 'http://localhost/api?s=1',
      method: 'GET',
      status: 200,
      contentType: 'text/event-stream',
      startedAt: 1_000,
      endedAt: 2_000,
      state: 'completed',
      source: 'fetch-stream',
      eventCount: 1,
      parseErrorCount: 0,
    }
    const har = exportRecordsToHar([
      {
        request,
        events: [
          {
            id: 'e1',
            requestId: 'r1',
            index: 0,
            timestamp: 1_100,
            data: '{"a":1}',
          },
        ],
        metrics: computeMetrics(request, [
          {
            id: 'e1',
            requestId: 'r1',
            index: 0,
            timestamp: 1_100,
            data: '{"a":1}',
          },
        ]),
      },
    ])
    expect(har.log.version).toBe('1.2')
    expect(har.log.entries).toHaveLength(1)
    expect(har.log.entries[0]._streamlens?.source).toBe('fetch-stream')
    expect(har.log.entries[0].response.content.text).toContain('data: {"a":1}')
  })
})
