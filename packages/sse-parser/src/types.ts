export interface ParsedSseEvent {
  event?: string
  id?: string
  retry?: number
  data: string
}

export interface SseParserOptions {
  /** Try to JSON.parse data after each complete event */
  parseJson?: boolean
}

export interface SseEventWithParse extends ParsedSseEvent {
  parsedData?: unknown
  parseError?: string
}
