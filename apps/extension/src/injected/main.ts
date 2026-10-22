import { STREAMLENS_PAGE_SOURCE } from '@streamlens/protocol'
import { installEventSourceHook } from './event-source-hook'
import { installFetchHook } from './fetch-hook'
import { setInjectedSessionId } from './session-id'

declare global {
  interface Window {
    __streamlensInstalled?: boolean
    __streamlensSessionId?: string
  }
}

function boot(sessionId: string): void {
  setInjectedSessionId(sessionId)
  window.__streamlensSessionId = sessionId
  if (window.__streamlensInstalled) return
  window.__streamlensInstalled = true
  installFetchHook()
  installEventSourceHook()
  window.postMessage({ source: STREAMLENS_PAGE_SOURCE, sessionId, type: 'PING' }, '*')
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return
  const data = ev.data
  if (!data || typeof data !== 'object') return
  if (data.source !== 'streamlens-bridge-init') return
  if (typeof data.sessionId !== 'string') return
  boot(data.sessionId)
})
