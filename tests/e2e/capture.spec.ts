import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { test, expect, chromium } from '@playwright/test'

const root = process.cwd()
const serverDir = path.join(root, 'fixtures/sse-demo-server')
const extensionDir = path.join(root, 'apps/extension/dist').replace(/\\/g, '/')
const PORT = 4176
const BASE = `http://127.0.0.1:${PORT}`

let server: ChildProcess | null = null

test.beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = spawn(process.execPath, ['server.js'], {
      cwd: serverDir,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'pipe',
    })
    const t = setTimeout(() => reject(new Error('server start timeout')), 10_000)
    server.stdout?.on('data', (b) => {
      if (String(b).includes('SSE demo')) {
        clearTimeout(t)
        resolve()
      }
    })
    server.on('error', reject)
  })
})

test.afterAll(() => {
  server?.kill()
})

test('extension captures SSE via E2E bridge', async () => {
  test.skip(!process.env.RUN_E2E, 'Set RUN_E2E=1 to run browser e2e')
  test.skip(
    !!process.env.CI,
    'Extension E2E is local-only (headed Chrome); CI uses integration tests',
  )

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  })

  try {
    let [worker] = context.serviceWorkers()
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 15_000 })
    }
    expect(worker.url()).toContain('chrome-extension://')

    const page = await context.newPage()
    await page.goto(`${BASE}/e2e.html`, { waitUntil: 'domcontentloaded' })
    await page.click('#run')
    await page.waitForFunction(
      () => (window as unknown as { __SL_SNAPSHOT__?: unknown }).__SL_SNAPSHOT__ !== undefined,
      null,
      { timeout: 60_000 },
    )
    const snap = await page.evaluate(
      () =>
        (
          window as unknown as {
            __SL_SNAPSHOT__: { requests: unknown[]; sessionId?: string; error?: string }
          }
        ).__SL_SNAPSHOT__,
    )
    const err = await page.evaluate(
      () => (window as unknown as { __SL_ERROR__?: string }).__SL_ERROR__,
    )
    expect(err, `page error: ${err}`).toBeFalsy()
    expect(snap.error, `snapshot error: ${snap.error}`).toBeFalsy()
    expect(snap.requests.length).toBeGreaterThan(0)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () =>
        (window as unknown as { __streamlensInstalled?: boolean }).__streamlensInstalled === true,
      null,
      { timeout: 15_000 },
    )
    const injectedSessionId = await page.evaluate(
      () => (window as unknown as { __streamlensSessionId?: string }).__streamlensSessionId,
    )
    expect(injectedSessionId).toBe(snap.sessionId)

    await page.evaluate(async () => {
      const res = await fetch('/api/sse')
      const reader = res.body!.getReader()
      while (!(await reader.read()).done) {
        /* drain */
      }
    })
    await page.waitForTimeout(800)

    const resumed = await page.evaluate(
      () =>
        new Promise<{ requests: Array<{ id: string }>; error?: string }>((resolve, reject) => {
          const source = 'streamlens-e2e-page'
          const timer = setTimeout(() => reject(new Error('snapshot timeout')), 15_000)
          const handler = (ev: MessageEvent) => {
            if (ev.data?.source === source && ev.data?.type === 'SNAPSHOT') {
              clearTimeout(timer)
              window.removeEventListener('message', handler)
              resolve(ev.data.data)
            }
          }
          window.addEventListener('message', handler)
          window.postMessage({ source, type: 'GET_SNAPSHOT' }, '*')
        }),
    )
    expect(resumed.error, `resumed snapshot error: ${resumed.error}`).toBeFalsy()
    expect(resumed.requests.length).toBeGreaterThan(snap.requests.length)
    expect(new Set(resumed.requests.map((r) => r.id)).size).toBe(resumed.requests.length)
  } finally {
    await context.close()
  }
})
