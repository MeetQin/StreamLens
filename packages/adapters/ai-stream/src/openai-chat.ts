import type { AiAdapterResult, AiStreamAdapter } from './types.js'

const DONE = '[DONE]'

function extractDelta(json: unknown): unknown | undefined {
  if (!json || typeof json !== 'object') return undefined
  const o = json as Record<string, unknown>
  const choices = o.choices
  if (!Array.isArray(choices) || !choices.length) return undefined
  const first = choices[0] as Record<string, unknown>
  if (first.delta !== undefined) return { delta: first.delta, index: first.index ?? 0 }
  if (first.message !== undefined) return { message: first.message, index: first.index ?? 0 }
  return { choice: first }
}

export const openAiChatCompletionsAdapter: AiStreamAdapter = {
  id: 'openai-chat-completions',

  match(url: string, contentType?: string): boolean {
    if (/chat\/completions/i.test(url)) return true
    if (contentType?.includes('text/event-stream') && /\/v1\//i.test(url)) return true
    return false
  },

  transform(rawData: string, json?: unknown): AiAdapterResult | null {
    const trimmed = rawData.trim()
    if (trimmed === DONE) {
      return { adapterId: 'openai-chat-completions', streamEnd: true, normalized: { done: true } }
    }
    if (json === undefined) return null
    const normalized = extractDelta(json)
    if (!normalized) return null
    return { adapterId: 'openai-chat-completions', normalized }
  },
}
