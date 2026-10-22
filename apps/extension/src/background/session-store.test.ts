import { CAPTURE_STATE_STORAGE_PREFIX, SESSION_STORAGE_PREFIX } from '@streamlens/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionData = new Map<string, unknown>()

vi.stubGlobal('chrome', {
  storage: {
    session: {
      get: vi.fn(async (key: string) => {
        const value = sessionData.get(key)
        return value === undefined ? {} : { [key]: value }
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) sessionData.set(key, value)
      }),
      remove: vi.fn(async (key: string) => {
        sessionData.delete(key)
      }),
    },
  },
})

vi.mock('./settings.js', () => ({
  getSettings: () => ({ persistSession: true }),
}))

import type { CaptureSession } from '@streamlens/core'
import {
  cancelScheduledPersist,
  clearCaptureState,
  clearPersisted,
  loadCaptureState,
  loadPersistedSession,
  saveCaptureState,
  schedulePersist,
} from './session-store.js'

describe('capture state persistence', () => {
  beforeEach(() => {
    sessionData.clear()
  })

  it('round-trips capture state and clears it', async () => {
    await saveCaptureState(7, 'sess_1')
    await expect(loadCaptureState(7)).resolves.toMatchObject({
      sessionId: 'sess_1',
      capturing: true,
    })

    await clearCaptureState(7)
    await expect(loadCaptureState(7)).resolves.toBeNull()
  })

  it('rejects malformed or stopped capture state', async () => {
    const key = `${CAPTURE_STATE_STORAGE_PREFIX}7`
    sessionData.set(key, { version: 2, sessionId: 'sess_1', capturing: true })
    await expect(loadCaptureState(7)).resolves.toBeNull()

    sessionData.set(key, { version: 1, sessionId: 'sess_1', capturing: false })
    await expect(loadCaptureState(7)).resolves.toBeNull()
  })
})

describe('session snapshot persistence', () => {
  beforeEach(() => {
    sessionData.clear()
  })

  it('loads a valid snapshot and ignores malformed ones', async () => {
    const key = `${SESSION_STORAGE_PREFIX}7`
    const snapshot = {
      version: 1,
      sessionId: 'sess_1',
      tabId: 7,
      savedAt: Date.now(),
      requests: [],
      eventsByRequest: {},
    }
    sessionData.set(key, snapshot)
    await expect(loadPersistedSession(7)).resolves.toMatchObject({ sessionId: 'sess_1' })

    sessionData.set(key, { version: 99 })
    await expect(loadPersistedSession(7)).resolves.toBeNull()

    sessionData.set(key, snapshot)
    await clearPersisted(7)
    await expect(loadPersistedSession(7)).resolves.toBeNull()
  })

  it('cancels a scheduled snapshot write', async () => {
    vi.useFakeTimers()
    try {
      const setSpy = vi.mocked(chrome.storage.session.set)
      setSpy.mockClear()
      const session = {
        sessionId: 'sess_1',
        getRequests: () => [],
        getEvents: () => [],
      } as unknown as CaptureSession

      schedulePersist(7, session)
      cancelScheduledPersist(7)
      await vi.advanceTimersByTimeAsync(1_000)

      expect(setSpy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
