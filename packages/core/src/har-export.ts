import type { StreamEvent, StreamRequest } from '@streamlens/protocol'
import { computeMetrics } from './session.js'

export interface StreamLensHarRecord {
  request: StreamRequest
  events: StreamEvent[]
  metrics: ReturnType<typeof computeMetrics>
}

export interface HarLog {
  version: string
  creator: { name: string; version: string }
  pages: Array<{ startedDateTime: string; id: string; title: string }>
  entries: HarEntry[]
}

export interface HarFile {
  log: HarLog
}

export interface HarEntry {
  startedDateTime: string
  time: number
  request: {
    method: string
    url: string
    httpVersion: string
    headers: Array<{ name: string; value: string }>
    queryString: Array<{ name: string; value: string }>
    headersSize: number
    bodySize: number
  }
  response: {
    status: number
    statusText: string
    httpVersion: string
    headers: Array<{ name: string; value: string }>
    content: {
      size: number
      mimeType: string
      text?: string
    }
    headersSize: number
    bodySize: number
  }
  cache: Record<string, never>
  timings: { send: number; wait: number; receive: number }
  _streamlens?: {
    source: StreamRequest['source']
    events: StreamEvent[]
    metrics: ReturnType<typeof computeMetrics>
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function parseQuery(url: string): Array<{ name: string; value: string }> {
  try {
    const u = new URL(url)
    return [...u.searchParams.entries()].map(([name, value]) => ({ name, value }))
  } catch {
    return []
  }
}

function eventsAsSseText(events: StreamEvent[]): string {
  return events
    .filter((e) => !e.streamEndMarker)
    .map((e) => {
      const lines: string[] = []
      if (e.eventType && e.eventType !== 'message') lines.push(`event: ${e.eventType}`)
      if (e.eventId) lines.push(`id: ${e.eventId}`)
      for (const line of e.data.split('\n')) lines.push(`data: ${line}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

export function exportRecordsToHar(
  records: StreamLensHarRecord[],
  options: { creatorVersion?: string; redact?: boolean } = {},
): HarFile {
  const version = options.creatorVersion ?? '0.1.0'
  const entries: HarEntry[] = records.map((rec) => {
    const body = eventsAsSseText(rec.events)
    const totalMs = rec.metrics.totalDurationMs ?? 0
    const waitMs = rec.metrics.firstEventLatencyMs ?? 0
    return {
      startedDateTime: iso(rec.request.startedAt),
      time: totalMs,
      request: {
        method: rec.request.method,
        url: rec.request.url,
        httpVersion: 'HTTP/1.1',
        headers: [
          {
            name: 'Content-Type',
            value: rec.request.contentType ?? 'text/event-stream',
          },
        ],
        queryString: parseQuery(rec.request.url),
        headersSize: -1,
        bodySize: 0,
      },
      response: {
        status: rec.request.status ?? 0,
        statusText: rec.request.state,
        httpVersion: 'HTTP/1.1',
        headers: [
          {
            name: 'Content-Type',
            value: rec.request.contentType ?? 'text/event-stream',
          },
        ],
        content: {
          size: body.length,
          mimeType: rec.request.contentType ?? 'text/event-stream',
          text: body,
        },
        headersSize: -1,
        bodySize: body.length,
      },
      cache: {},
      timings: {
        send: 0,
        wait: waitMs,
        receive: Math.max(0, totalMs - waitMs),
      },
      _streamlens: {
        source: rec.request.source,
        events: rec.events,
        metrics: rec.metrics,
      },
    }
  })

  const firstStarted = records[0]?.request.startedAt ?? Date.now()

  return {
    log: {
      version: '1.2',
      creator: { name: 'StreamLens', version },
      pages: [
        {
          id: 'page_1',
          title: 'StreamLens Capture',
          startedDateTime: iso(firstStarted),
        },
      ],
      entries,
    },
  }
}
