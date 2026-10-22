import { STREAMLENS_PAGE_SOURCE } from '@streamlens/protocol'
import { getInjectedSessionId } from './session-id'

function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function getAcceptHeader(init?: RequestInit, input?: RequestInfo | URL): string | null {
  if (init?.headers) {
    const h = new Headers(init.headers)
    return h.get('accept')
  }
  if (input instanceof Request) {
    return input.headers.get('accept')
  }
  return null
}

function isStreamContentType(ct: string | null, url: string, accept: string | null): boolean {
  if (!ct) {
    return /\/(sse|stream|events)\b/i.test(url) || /\b(sse|stream)=/i.test(url)
  }
  const lower = ct.toLowerCase()
  if (lower.includes('text/event-stream')) return true
  if (lower.includes('application/stream+json')) return true
  if (lower.includes('application/x-ndjson')) return true
  if (lower.includes('text/plain')) {
    if (accept?.includes('text/event-stream')) return true
    if (/\/(sse|stream|events|chat)\b/i.test(url)) return true
  }
  return false
}

function post(msg: Record<string, unknown>): void {
  window.postMessage({ source: STREAMLENS_PAGE_SOURCE, ...msg }, '*')
}

function resolveAbortSignal(
  init?: RequestInit,
  input?: RequestInfo | URL,
): AbortSignal | undefined {
  if (init?.signal) return init.signal
  if (input instanceof Request) return input.signal
  return undefined
}

export function installFetchHook(): void {
  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const sessionId = getInjectedSessionId()
    if (!sessionId) return original(input, init)

    const startedAt = Date.now()
    let url: string
    let method = init?.method ?? 'GET'

    if (input instanceof Request) {
      url = input.url
      method = input.method
    } else {
      url = String(input)
    }

    const response = await original(input, init)

    const contentType = response.headers.get('content-type')
    const accept = getAcceptHeader(init, input)
    const body = response.body
    if (!body || !isStreamContentType(contentType, url, accept)) {
      return response
    }

    const requestId = newRequestId()
    post({
      sessionId,
      type: 'REQUEST_STARTED',
      requestId,
      url,
      method,
      requestSource: 'fetch-stream',
      contentType: contentType ?? undefined,
      startedAt,
    })
    post({
      sessionId,
      type: 'REQUEST_META',
      requestId,
      status: response.status,
      contentType: contentType ?? undefined,
    })

    const signal = resolveAbortSignal(init, input)
    if (signal) {
      if (signal.aborted) {
        post({ sessionId, type: 'REQUEST_FINISHED', requestId, reason: 'abort' })
      } else {
        signal.addEventListener(
          'abort',
          () => {
            post({
              sessionId,
              type: 'REQUEST_FINISHED',
              requestId,
              reason: 'abort',
              errorMessage: 'Request aborted',
            })
          },
          { once: true },
        )
      }
    }

    const [tap, business] = body.tee()
    void pumpTap(sessionId, requestId, tap)

    return new Response(business, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}

async function pumpTap(
  sessionId: string,
  requestId: string,
  body: ReadableStream<Uint8Array>,
): Promise<void> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        post({ sessionId, type: 'REQUEST_FINISHED', requestId, reason: 'eof' })
        break
      }
      if (value && value.length) {
        post({
          sessionId,
          type: 'SSE_CHUNK',
          requestId,
          chunk: decoder.decode(value, { stream: true }),
        })
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const reason = msg.toLowerCase().includes('abort') ? 'abort' : 'error'
    post({
      sessionId,
      type: 'REQUEST_FINISHED',
      requestId,
      reason,
      errorMessage: msg,
    })
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }
}
