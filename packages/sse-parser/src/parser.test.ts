import { describe, expect, it } from 'vitest'
import { SseParser, enrichWithJson, tryParseEventJson } from './index.js'

describe('SseParser', () => {
  it('parses single data line with LF', () => {
    const p = new SseParser()
    const events = p.push('data: hello\n\n')
    expect(events).toEqual([{ data: 'hello' }])
  })

  it('parses CRLF', () => {
    const p = new SseParser()
    const events = p.push('data: a\r\ndata: b\r\n\r\n')
    expect(events).toEqual([{ data: 'a\nb' }])
  })

  it('parses event, id, retry', () => {
    const p = new SseParser()
    const events = p.push('event: tick\ndata: 1\nid: abc\nretry: 3000\n\n')
    expect(events).toEqual([
      { event: 'tick', id: 'abc', retry: 3000, data: '1' },
    ])
  })

  it('skips comment lines', () => {
    const p = new SseParser()
    const events = p.push(': heartbeat\n\ndata: x\n\n')
    expect(events).toEqual([{ data: 'x' }])
  })

  it('handles chunk split mid-field', () => {
    const p = new SseParser()
    expect(p.push('da')).toEqual([])
    expect(p.push('ta: hel')).toEqual([])
    expect(p.push('lo\n\n')).toEqual([{ data: 'hello' }])
  })

  it('handles UTF-8 split across chunks', () => {
    const p = new SseParser()
    const full = 'data: 中文测试\n\n'
    const mid = Math.floor(full.length / 2)
    expect(p.push(full.slice(0, mid))).toEqual([])
    expect(p.push(full.slice(mid))).toEqual([{ data: '中文测试' }])
  })

  it('returns multiple events in one push', () => {
    const p = new SseParser()
    const events = p.push('data: 1\n\ndata: 2\n\n')
    expect(events).toHaveLength(2)
  })

  it('flush emits incomplete block when forced', () => {
    const p = new SseParser()
    p.push('data: partial')
    expect(p.flush()).toEqual([{ data: 'partial' }])
  })
})

describe('tryParseEventJson', () => {
  it('parses valid JSON', () => {
    expect(tryParseEventJson('{"a":1}')).toEqual({ parsed: { a: 1 } })
  })

  it('marks invalid JSON', () => {
    const r = tryParseEventJson('{bad')
    expect(r.error).toBeTruthy()
  })

  it('treats [DONE] as sentinel', () => {
    expect(tryParseEventJson('[DONE]')).toEqual({ parsed: '[DONE]' })
  })
})

describe('enrichWithJson', () => {
  it('adds parse error without throwing', () => {
    const e = enrichWithJson({ data: 'not-json' }, true)
    expect(e.parseError).toBeTruthy()
  })
})
