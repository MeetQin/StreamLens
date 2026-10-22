export interface AiAdapterResult {
  /** Normalized view for UI / export */
  normalized?: unknown
  /** When true, stream should end (e.g. OpenAI `[DONE]`) */
  streamEnd?: boolean
  adapterId: string
  parseError?: string
}

export interface AiStreamAdapter {
  id: string
  match(url: string, contentType?: string): boolean
  transform(rawData: string, json?: unknown): AiAdapterResult | null
}
