import type { StreamLensSettings } from '@streamlens/protocol'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@streamlens/protocol'
import type { CaptureSession } from '@streamlens/core'

let cached: StreamLensSettings = { ...DEFAULT_SETTINGS, limits: { ...DEFAULT_SETTINGS.limits } }

export async function loadSettings(): Promise<StreamLensSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
  const raw = stored[SETTINGS_STORAGE_KEY] as Partial<StreamLensSettings> | undefined
  if (raw) {
    cached = {
      enableAiAdapter: raw.enableAiAdapter ?? DEFAULT_SETTINGS.enableAiAdapter,
      redactOnExport: raw.redactOnExport ?? DEFAULT_SETTINGS.redactOnExport,
      enableCdpMetadata: raw.enableCdpMetadata ?? DEFAULT_SETTINGS.enableCdpMetadata,
      enableCdpBodyStream: raw.enableCdpBodyStream ?? DEFAULT_SETTINGS.enableCdpBodyStream,
      persistSession: raw.persistSession ?? DEFAULT_SETTINGS.persistSession,
      limits: { ...DEFAULT_SETTINGS.limits, ...raw.limits },
    }
  }
  return cached
}

export function getSettings(): StreamLensSettings {
  return cached
}

export async function saveSettings(next: StreamLensSettings): Promise<void> {
  cached = {
    ...next,
    limits: { ...next.limits },
  }
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: cached })
}

export function applySettingsToSession(session: CaptureSession): void {
  session.configure({
    enableAiAdapter: cached.enableAiAdapter,
    redactOnExport: cached.redactOnExport,
    limits: cached.limits,
  })
}

void loadSettings()
