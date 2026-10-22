import type { ParsedSseEvent, SseEventWithParse, SseParserOptions } from './types.js'

interface EventBuilder {
  event?: string
  id?: string
  retry?: number
  dataLines: string[]
}

/**
 * Incremental SSE parser (WHATWG / HTML SSE format).
 * Handles LF, CRLF, comments, multi-line data, and arbitrary chunk boundaries.
 */
export class SseParser {
  private buffer = ''

  constructor(_options: SseParserOptions = {}) {
    /* options reserved for future adapter hooks */
  }

  push(chunk: string): ParsedSseEvent[] {
    this.buffer += chunk
    return this.drainCompleteEvents()
  }

  flush(): ParsedSseEvent[] {
    const events = this.drainCompleteEvents(true)
    this.buffer = ''
    return events
  }

  get pendingBuffer(): string {
    return this.buffer
  }

  private drainCompleteEvents(flushPartial = false): ParsedSseEvent[] {
    const out: ParsedSseEvent[] = []
    while (true) {
      const sep = findEventSeparator(this.buffer)
      if (sep === -1) {
        if (flushPartial && this.buffer.trim().length > 0) {
          const ev = parseEventBlock(this.buffer)
          if (ev) out.push(ev)
        }
        break
      }
      const block = this.buffer.slice(0, sep.index)
      this.buffer = this.buffer.slice(sep.index + sep.length)
      const ev = parseEventBlock(block)
      if (ev) out.push(ev)
    }
    return out
  }
}

function findEventSeparator(buf: string): { index: number; length: number } | -1 {
  const lf = buf.indexOf('\n\n')
  const crlf = buf.indexOf('\r\n\r\n')
  if (lf === -1 && crlf === -1) return -1
  if (lf === -1) return { index: crlf, length: 4 }
  if (crlf === -1) return { index: lf, length: 2 }
  return lf < crlf ? { index: lf, length: 2 } : { index: crlf, length: 4 }
}

function parseEventBlock(block: string): ParsedSseEvent | null {
  const lines = splitLines(block)
  const builder: EventBuilder = { dataLines: [] }
  let hasField = false

  for (const line of lines) {
    if (line.startsWith(':')) continue
    const parsed = parseFieldLine(line)
    if (!parsed) continue
    hasField = true
    const { field, value } = parsed
    switch (field) {
      case 'event':
        builder.event = value
        break
      case 'data':
        builder.dataLines.push(value)
        break
      case 'id':
        builder.id = value
        break
      case 'retry': {
        const n = Number.parseInt(value, 10)
        if (!Number.isNaN(n)) builder.retry = n
        break
      }
      default:
        break
    }
  }

  if (!hasField) return null
  const data = builder.dataLines.join('\n')
  if (data === '' && !builder.event && builder.id === undefined && builder.retry === undefined) {
    return null
  }
  return {
    event: builder.event,
    id: builder.id,
    retry: builder.retry,
    data,
  }
}

function splitLines(block: string): string[] {
  const lines: string[] = []
  let i = 0
  while (i < block.length) {
    const cr = block.indexOf('\r', i)
    const lf = block.indexOf('\n', i)
    if (lf === -1 && cr === -1) {
      lines.push(block.slice(i))
      break
    }
    if (lf !== -1 && (cr === -1 || lf <= cr)) {
      lines.push(block.slice(i, lf))
      i = lf + 1
    } else if (cr !== -1) {
      lines.push(block.slice(i, cr))
      i = cr + 1
      if (block[i] === '\n') i++
    }
  }
  return lines
}

function parseFieldLine(line: string): { field: string; value: string } | null {
  const colon = line.indexOf(':')
  if (colon === 0) return null
  if (colon === -1) {
    return { field: line, value: '' }
  }
  const field = line.slice(0, colon)
  let value = line.slice(colon + 1)
  if (value.startsWith(' ')) value = value.slice(1)
  return { field, value }
}

export function tryParseEventJson(data: string): { parsed?: unknown; error?: string } {
  const trimmed = data.trim()
  if (!trimmed) return {}
  if (trimmed === '[DONE]') return { parsed: '[DONE]' }
  try {
    return { parsed: JSON.parse(trimmed) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export function enrichWithJson(
  event: ParsedSseEvent,
  parseJson: boolean,
): SseEventWithParse {
  if (!parseJson) return { ...event }
  const { parsed, error } = tryParseEventJson(event.data)
  return {
    ...event,
    parsedData: parsed,
    parseError: error,
  }
}
