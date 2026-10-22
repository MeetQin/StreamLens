import { openAiChatCompletionsAdapter } from './openai-chat.js'
import type { AiAdapterResult, AiStreamAdapter } from './types.js'

export type { AiAdapterResult, AiStreamAdapter } from './types.js'
export { openAiChatCompletionsAdapter } from './openai-chat.js'

export const defaultAiAdapters: AiStreamAdapter[] = [openAiChatCompletionsAdapter]

export function pickAiAdapter(
  url: string,
  contentType: string | undefined,
  adapters: AiStreamAdapter[] = defaultAiAdapters,
): AiStreamAdapter | null {
  for (const a of adapters) {
    if (a.match(url, contentType)) return a
  }
  return null
}

export function applyAiAdapters(
  url: string,
  contentType: string | undefined,
  rawData: string,
  json?: unknown,
  adapters: AiStreamAdapter[] = defaultAiAdapters,
): AiAdapterResult | null {
  const adapter = pickAiAdapter(url, contentType, adapters)
  if (!adapter) {
    if (rawData.trim() === '[DONE]') {
      return { adapterId: 'generic-done-marker', streamEnd: true, normalized: { done: true } }
    }
    return null
  }
  return adapter.transform(rawData, json)
}
