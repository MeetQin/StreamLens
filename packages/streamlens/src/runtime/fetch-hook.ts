import type { CaptureController } from './controller.js'
import {
  getAcceptHeader,
  isStreamContentType,
  pumpStream,
  resolveAbortSignal,
} from './hook-utils.js'

export function installFetchHook(controller: CaptureController): () => void {
  const original = window.fetch

  const patched = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    if (!controller.isCapturing()) return original(input, init)

    const startedAt = Date.now()
    const url = input instanceof Request ? input.url : String(input)
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()

    const response = await original(input, init)

    const contentType = response.headers.get('content-type')
    const accept = getAcceptHeader(init, input)
    const body = response.body
    if (!body || !isStreamContentType(contentType, url, accept)) return response

    const requestId = controller.newRequestId('req')
    controller.startRequest({
      id: requestId,
      url,
      method,
      status: response.status,
      contentType: contentType ?? undefined,
      startedAt,
      source: 'fetch-stream',
    })

    const signal = resolveAbortSignal(init, input)
    if (signal) {
      if (signal.aborted) {
        controller.finishRequest(requestId, 'abort', 'Request aborted')
      } else {
        signal.addEventListener(
          'abort',
          () => controller.finishRequest(requestId, 'abort', 'Request aborted'),
          { once: true },
        )
      }
    }

    const [tap, business] = body.tee()
    void pumpStream(tap, {
      onChunk: (text) => controller.pushChunk(requestId, text),
      onDone: () => controller.finishRequest(requestId, 'eof'),
      onError: (message) =>
        controller.finishRequest(
          requestId,
          message.toLowerCase().includes('abort') ? 'abort' : 'error',
          message,
        ),
    })

    return new Response(business, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  window.fetch = patched as typeof window.fetch
  return () => {
    if (window.fetch === patched) window.fetch = original
  }
}
