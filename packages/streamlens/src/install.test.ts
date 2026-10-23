import { describe, expect, it } from 'vitest'
import { installStreamLens } from './index.js'

describe('installStreamLens', () => {
  it('refuses to run outside a browser', () => {
    expect(() => installStreamLens()).toThrow(/browser environment/)
  })
})
