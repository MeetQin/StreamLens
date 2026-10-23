export function getAcceptHeader(
  init?: RequestInit,
  input?: RequestInfo | URL,
): string | null {
  if (init?.headers) {
    return new Headers(init.headers).get('accept')
  }
  if (input instanceof Request) {
    return input.headers.get('accept')
  }
  return null
}

export function isStreamContentType(
  contentType: string | null,
  url: string,
  accept: string | null,
): boolean {
  if (!contentType) {
    return /\/(sse|stream|events)\b/i.test(url) || /\b(sse|stream)=/i.test(url)
  }
  const lower = contentType.toLowerCase()
  if (lower.includes('text/event-stream')) return true
  if (lower.includes('application/stream+json')) return true
  if (lower.includes('application/x-ndjson')) return true
  if (lower.includes('text/plain')) {
    if (accept?.includes('text/event-stream')) return true
    if (/\/(sse|stream|events|chat)\b/i.test(url)) return true
  }
  return false
}

export function resolveAbortSignal(
  init?: RequestInit,
  input?: RequestInfo | URL,
): AbortSignal | undefined {
  if (init?.signal) return init.signal
  if (input instanceof Request) return input.signal
  return undefined
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export interface StreamPumpHandlers {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

export async function pumpStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamPumpHandlers,
): Promise<void> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        const tail = decoder.decode()
        if (tail) handlers.onChunk(tail)
        handlers.onDone()
        break
      }
      if (value && value.length) {
        const text = decoder.decode(value, { stream: true })
        if (text) handlers.onChunk(text)
      }
    }
  } catch (error) {
    handlers.onError(toErrorMessage(error))
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }
}
