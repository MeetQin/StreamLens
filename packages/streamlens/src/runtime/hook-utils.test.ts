import { describe, expect, it } from 'vitest'
import { isStreamContentType, pumpStream } from './hook-utils.js'

describe('isStreamContentType', () => {
  it('accepts SSE and streaming content types', () => {
    expect(isStreamContentType('text/event-stream', 'https://x/api', null)).toBe(true)
    expect(isStreamContentType('text/event-stream; charset=utf-8', '/api', null)).toBe(true)
    expect(isStreamContentType('application/x-ndjson', '/api', null)).toBe(true)
    expect(isStreamContentType('application/stream+json', '/api', null)).toBe(true)
  })

  it('uses URL and Accept heuristics for text/plain', () => {
    expect(isStreamContentType('text/plain', 'https://x/api/sse', null)).toBe(true)
    expect(
      isStreamContentType('text/plain', 'https://x/api/chat', 'text/event-stream'),
    ).toBe(true)
    expect(isStreamContentType('text/plain', 'https://x/api/data', null)).toBe(false)
  })

  it('falls back to the URL when content type is missing', () => {
    expect(isStreamContentType(null, 'https://x/api/stream', null)).toBe(true)
    expect(isStreamContentType(null, 'https://x/api/data?stream=1', null)).toBe(true)
    expect(isStreamContentType(null, 'https://x/api/data', null)).toBe(false)
    expect(isStreamContentType('application/json', 'https://x/api', null)).toBe(false)
  })
})

describe('pumpStream', () => {
  it('decodes UTF-8 across chunk boundaries and flushes the tail', async () => {
    const bytes = new TextEncoder().encode('data: 你好\n\n')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 8))
        controller.enqueue(bytes.slice(8))
        controller.close()
      },
    })
    const chunks: string[] = []
    let done = false
    let error: string | null = null

    await pumpStream(body, {
      onChunk: (text) => chunks.push(text),
      onDone: () => {
        done = true
      },
      onError: (message) => {
        error = message
      },
    })

    expect(chunks.join('')).toBe('data: 你好\n\n')
    expect(done).toBe(true)
    expect(error).toBeNull()
  })

  it('reports read errors', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('boom'))
      },
    })
    let done = false
    let error: string | null = null

    await pumpStream(body, {
      onChunk: () => {},
      onDone: () => {
        done = true
      },
      onError: (message) => {
        error = message
      },
    })

    expect(done).toBe(false)
    expect(error).toBe('boom')
  })
})
