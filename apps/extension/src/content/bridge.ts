import { STREAMLENS_BRIDGE_SOURCE } from '@streamlens/protocol'
import { isValidBridgePayload } from '../shared/message-guard'
import { isPageMessage, type PageToBridgeMessage } from '../shared/page-messages'

declare const __STREAMLENS_E2E__: boolean

const activeSessions = new Set<string>()
const E2E_PAGE_SOURCE = 'streamlens-e2e-page'

type InjectionState = 'idle' | 'injecting' | 'loaded'
let injectionState: InjectionState = 'idle'
let desiredSessionId = ''

void chrome.runtime
  .sendMessage({ type: 'STREAMLENS_HELLO' })
  .then((response: unknown) => {
    if (!response || typeof response !== 'object') return
    const res = response as { capturing?: unknown; sessionId?: unknown }
    if (res.capturing === true && typeof res.sessionId === 'string') {
      registerSession(res.sessionId)
    }
  })
  .catch(() => undefined)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'STREAMLENS_REGISTER_SESSION' && typeof message.sessionId === 'string') {
    registerSession(message.sessionId)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'STREAMLENS_UNREGISTER_SESSION' && typeof message.sessionId === 'string') {
    activeSessions.delete(message.sessionId)
    if (activeSessions.size === 0) {
      desiredSessionId = ''
      if (injectionState === 'loaded') postBridgeInit('')
    }
    sendResponse({ ok: true })
    return true
  }
  return false
})

function registerSession(sessionId: string): void {
  activeSessions.clear()
  activeSessions.add(sessionId)
  desiredSessionId = sessionId
  if (injectionState === 'loaded') {
    postBridgeInit(sessionId)
    return
  }
  if (injectionState === 'injecting') return
  injectPageScript()
}

function postBridgeInit(sessionId: string): void {
  window.postMessage({ source: 'streamlens-bridge-init', sessionId }, '*')
}

function injectPageScript(): void {
  const root = document.documentElement ?? document.head
  if (!root) {
    document.addEventListener('DOMContentLoaded', injectPageScript, { once: true })
    return
  }

  injectionState = 'injecting'
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('assets/injected.js')
  script.async = false
  script.onload = () => {
    script.remove()
    injectionState = 'loaded'
    if (desiredSessionId) postBridgeInit(desiredSessionId)
  }
  script.onerror = () => {
    script.remove()
    injectionState = 'idle'
  }
  root.appendChild(script)
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return

  if (typeof __STREAMLENS_E2E__ !== 'undefined' && __STREAMLENS_E2E__) {
    handleE2ePageMessage(ev.data)
  }

  if (!isPageMessage(ev.data)) return
  const msg = ev.data as PageToBridgeMessage
  if (!activeSessions.has(msg.sessionId)) return
  if (!isValidBridgePayload(msg as unknown as Record<string, unknown>)) return

  chrome.runtime.sendMessage({
    ...msg,
    source: STREAMLENS_BRIDGE_SOURCE,
  })
})

function handleE2ePageMessage(data: unknown): void {
  if (document.documentElement.getAttribute('data-streamlens-e2e') !== '1') return
  if (!data || typeof data !== 'object') return
  const msg = data as Record<string, unknown>
  if (msg.source !== E2E_PAGE_SOURCE) return

  if (msg.type === 'START_CAPTURE') {
    chrome.runtime.sendMessage({ type: 'E2E_START_CAPTURE' })
  }
  if (msg.type === 'GET_SNAPSHOT') {
    void (async () => {
      let resp: unknown = null
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          resp = await chrome.runtime.sendMessage({ type: 'E2E_GET_SNAPSHOT' })
          break
        } catch {
          await new Promise((r) => setTimeout(r, 400))
        }
      }
      window.postMessage({ source: E2E_PAGE_SOURCE, type: 'SNAPSHOT', data: resp }, '*')
    })()
  }
}
