import {
  createSessionSnapshot,
  isSessionSnapshot,
  type CaptureSession,
  type SessionSnapshot,
} from '@streamlens/core'
import { CAPTURE_STATE_STORAGE_PREFIX, SESSION_STORAGE_PREFIX } from '@streamlens/protocol'
import { getSettings } from './settings.js'

export interface PersistedCaptureState {
  version: 1
  sessionId: string
  capturing: boolean
  savedAt: number
}

const persistTimers = new Map<number, ReturnType<typeof setTimeout>>()

function storageKey(tabId: number): string {
  return `${SESSION_STORAGE_PREFIX}${tabId}`
}

function captureKey(tabId: number): string {
  return `${CAPTURE_STATE_STORAGE_PREFIX}${tabId}`
}

export async function loadCaptureState(tabId: number): Promise<PersistedCaptureState | null> {
  const raw = await chrome.storage.session.get(captureKey(tabId))
  const state = raw[captureKey(tabId)] as PersistedCaptureState | undefined
  if (
    !state ||
    state.version !== 1 ||
    typeof state.sessionId !== 'string' ||
    state.capturing !== true
  ) {
    return null
  }
  return state
}

export async function saveCaptureState(tabId: number, sessionId: string): Promise<void> {
  const state: PersistedCaptureState = {
    version: 1,
    sessionId,
    capturing: true,
    savedAt: Date.now(),
  }
  await chrome.storage.session.set({ [captureKey(tabId)]: state })
}

export async function clearCaptureState(tabId: number): Promise<void> {
  await chrome.storage.session.remove(captureKey(tabId))
}

export async function loadPersistedSession(tabId: number): Promise<SessionSnapshot | null> {
  if (!getSettings().persistSession) return null
  const raw = await chrome.storage.session.get(storageKey(tabId))
  const snap = raw[storageKey(tabId)]
  return isSessionSnapshot(snap) ? snap : null
}

export function schedulePersist(tabId: number, session: CaptureSession): void {
  if (!getSettings().persistSession) return
  cancelScheduledPersist(tabId)
  persistTimers.set(
    tabId,
    setTimeout(() => {
      persistTimers.delete(tabId)
      void persistNow(tabId, session).catch(() => undefined)
    }, 800),
  )
}

export function cancelScheduledPersist(tabId: number): void {
  const timer = persistTimers.get(tabId)
  if (timer) clearTimeout(timer)
  persistTimers.delete(tabId)
}

export async function persistNow(tabId: number, session: CaptureSession): Promise<void> {
  if (!getSettings().persistSession) return
  const requests = session.getRequests()
  const eventsByRequest: Record<string, ReturnType<CaptureSession['getEvents']>> = {}
  for (const r of requests) {
    eventsByRequest[r.id] = session.getEvents(r.id)
  }
  const snap = createSessionSnapshot(session.sessionId, tabId, requests, eventsByRequest)
  await chrome.storage.session.set({ [storageKey(tabId)]: snap })
}

export async function clearPersisted(tabId: number): Promise<void> {
  await chrome.storage.session.remove(storageKey(tabId))
}
