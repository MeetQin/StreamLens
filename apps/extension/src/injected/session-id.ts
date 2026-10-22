let currentSessionId = ''

export function setInjectedSessionId(sessionId: string): void {
  currentSessionId = sessionId
}

export function getInjectedSessionId(): string {
  return currentSessionId
}
