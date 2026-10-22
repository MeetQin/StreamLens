export interface StreamLensLimits {
  maxEventDataChars: number
  maxEventsPerRequest: number
  maxRequests: number
}

export const DEFAULT_LIMITS: StreamLensLimits = {
  maxEventDataChars: 256 * 1024,
  maxEventsPerRequest: 10_000,
  maxRequests: 500,
}
