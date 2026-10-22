import { describe, expect, it } from 'vitest'
import { decodeCdpIoData } from './cdp-decode.js'

describe('decodeCdpIoData', () => {
  it('passes through plain text', () => {
    expect(decodeCdpIoData('data: hello\n\n', false)).toBe('data: hello\n\n')
  })

  it('decodes base64 UTF-8', () => {
    const b64 = btoa('data: ping\n\n')
    expect(decodeCdpIoData(b64, true)).toBe('data: ping\n\n')
  })
})
