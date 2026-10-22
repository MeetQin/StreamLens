const SENSITIVE_HEADER_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
]

export function redactSensitiveInUrl(url: string): string {
  try {
    const u = new URL(url)
    for (const key of [...u.searchParams.keys()]) {
      if (/token|key|secret|auth|session/i.test(key)) {
        u.searchParams.set(key, '[REDACTED]')
      }
    }
    return u.toString()
  } catch {
    return url
  }
}

export function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.includes(k.toLowerCase())) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = v
    }
  }
  return out
}

export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  return {
    text: text.slice(0, maxChars) + '\n… [truncated]',
    truncated: true,
  }
}

const BEARER_RE = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g

export function redactSensitiveInText(text: string): string {
  return text.replace(BEARER_RE, 'Bearer [REDACTED]').replace(JWT_RE, '[REDACTED_JWT]')
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveInText(value)
  if (Array.isArray(value)) return value.map(redactUnknown)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|secret|token|authorization|cookie|api[_-]?key/i.test(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = redactUnknown(v)
      }
    }
    return out
  }
  return value
}
