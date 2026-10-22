import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CaptureSession } from '@streamlens/core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.join(__dirname, '../../fixtures/sse-demo-server')
const PORT = 4174
const BASE = `http://127.0.0.1:${PORT}`

let child: ReturnType<typeof spawn> | null = null

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: serverDir,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'pipe',
    })
    const timer = setTimeout(() => reject(new Error('demo server timeout')), 8000)
    child.stdout?.on('data', (buf) => {
      if (String(buf).includes('SSE demo')) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.stderr?.on('data', (d) => console.error(String(d)))
    child.on('error', reject)
  })
})

afterAll(async () => {
  child?.kill()
})

describe('SSE demo server + CaptureSession', () => {
  it('parses fetch SSE stream end-to-end', async () => {
    const session = new CaptureSession(1, 'int_test')
    const startedAt = Date.now()
    const requestId = 'req_int'
    session.startRequest({
      id: requestId,
      tabId: 1,
      url: `${BASE}/api/sse`,
      method: 'GET',
      startedAt,
      source: 'fetch-stream',
      contentType: 'text/event-stream',
    })

    const res = await fetch(`${BASE}/api/sse`)
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      session.pushChunk(requestId, dec.decode(value, { stream: true }))
    }
    session.finishRequest(requestId, 'eof')

    const events = session.getEvents(requestId)
    expect(events.length).toBeGreaterThan(3)
    expect(session.getRequests()[0].state).toBe('completed')
    expect(events.some((e) => e.streamEndMarker)).toBe(true)
  })

  it('applies OpenAI adapter on chat/completions', async () => {
    const session = new CaptureSession(1, 'int_openai')
    const requestId = 'req_oai'
    session.startRequest({
      id: requestId,
      tabId: 1,
      url: `${BASE}/v1/chat/completions`,
      method: 'POST',
      startedAt: Date.now(),
      source: 'fetch-stream',
      contentType: 'text/event-stream',
    })

    const res = await fetch(`${BASE}/v1/chat/completions`, { method: 'POST', body: '{}' })
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      session.pushChunk(requestId, dec.decode(value, { stream: true }))
    }
    session.finishRequest(requestId, 'eof')

    const events = session.getEvents(requestId).filter((e) => !e.streamEndMarker)
    expect(events.some((e) => e.adapterId === 'openai-chat-completions')).toBe(true)
    expect(events.some((e) => e.normalizedData !== undefined)).toBe(true)
  })
})
