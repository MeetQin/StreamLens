import { describe, expect, it } from 'vitest'
import { redactSensitiveInText, redactSensitiveInUrl } from './sanitize.js'

describe('sanitize', () => {
  it('redacts bearer tokens in text', () => {
    expect(redactSensitiveInText('Auth Bearer abc.def.ghi')).toContain('[REDACTED]')
  })

  it('redacts sensitive query params', () => {
    const url = redactSensitiveInUrl('https://x.test/api?token=secret&page=1')
    expect(decodeURIComponent(url)).toContain('[REDACTED]')
    expect(url).toContain('page=1')
  })
})
