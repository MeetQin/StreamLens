import { DEFAULT_LIMITS, type StreamLensLimits } from './limits.js'

export interface StreamLensSettings {
  enableAiAdapter: boolean
  redactOnExport: boolean
  /** Optional CDP (debugger) metadata enrichment — no response body */
  enableCdpMetadata: boolean
  /**
   * Prototype: read streaming bodies via CDP Network.streamResourceContent + IO.read.
   * Skips URLs already captured by page injection. Requires debugger permission.
   */
  enableCdpBodyStream: boolean
  /** Restore last capture snapshot when reopening DevTools for the same tab */
  persistSession: boolean
  limits: StreamLensLimits
}

export const DEFAULT_SETTINGS: StreamLensSettings = {
  enableAiAdapter: true,
  redactOnExport: true,
  enableCdpMetadata: false,
  enableCdpBodyStream: false,
  persistSession: true,
  limits: { ...DEFAULT_LIMITS },
}

export const SESSION_STORAGE_PREFIX = 'streamlens_session_v1_'

export const CAPTURE_STATE_STORAGE_PREFIX = 'streamlens_capture_v1_'

export const SETTINGS_STORAGE_KEY = 'streamlens_settings'
