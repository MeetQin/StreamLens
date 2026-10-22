import { describe, expect, it } from 'vitest'
import { applyAiAdapters, openAiChatCompletionsAdapter } from './index.js'

describe('openAiChatCompletionsAdapter', () => {
  it('detects [DONE] as stream end', () => {
    const r = applyAiAdapters(
      'https://api.openai.com/v1/chat/completions',
      'text/event-stream',
      '[DONE]',
    )
    expect(r?.streamEnd).toBe(true)
  })

  it('extracts delta from chunk JSON', () => {
    const json = {
      choices: [{ index: 0, delta: { content: 'hi' } }],
    }
    const r = openAiChatCompletionsAdapter.transform(JSON.stringify(json), json)
    expect(r?.normalized).toEqual({ delta: { content: 'hi' }, index: 0 })
  })

  it('matches chat completions URL', () => {
    expect(
      openAiChatCompletionsAdapter.match('http://localhost/v1/chat/completions'),
    ).toBe(true)
  })
})
