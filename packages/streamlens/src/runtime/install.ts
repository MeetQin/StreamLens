import { mountPanel } from '../ui/mount.js'
import type {
  CapturedEvent,
  CapturedRequest,
  StreamLensExportRecord,
  StreamLensInstance,
  StreamLensOptions,
} from '../types.js'
import { VERSION } from '../version.js'
import { CaptureController } from './controller.js'
import { installEventSourceHook } from './event-source-hook.js'
import { installFetchHook } from './fetch-hook.js'

const GLOBAL_KEY = '__streamlens'

function globalSlot(): Record<string, unknown> {
  return window as unknown as Record<string, unknown>
}

export function installStreamLens(
  options: StreamLensOptions = {},
): StreamLensInstance {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      '[StreamLens] installStreamLens() must be called in a browser environment',
    )
  }

  const existing = globalSlot()[GLOBAL_KEY] as StreamLensInstance | undefined
  if (existing) {
    if (options.open) existing.open()
    return existing
  }

  const controller = new CaptureController(options)
  const uninstallFetch = installFetchHook(controller)
  const uninstallEventSource = installEventSourceHook(controller)
  const panel = mountPanel(controller, options)
  let destroyed = false

  const instance: StreamLensInstance = {
    version: VERSION,
    start: () => controller.start(),
    stop: () => controller.stop(),
    clear: () => controller.clear(),
    open: () => panel.open(),
    close: () => panel.close(),
    isCapturing: () => controller.isCapturing(),
    getRequests: () => controller.getRequests() as unknown as CapturedRequest[],
    getEvents: (requestId) =>
      controller.getEvents(requestId) as unknown as CapturedEvent[],
    exportJson: () => controller.exportJson() as unknown as StreamLensExportRecord[],
    exportHar: () => controller.exportHar(),
    destroy: () => {
      if (destroyed) return
      destroyed = true
      if (controller.isCapturing()) controller.stop()
      panel.destroy()
      uninstallFetch()
      uninstallEventSource()
      controller.destroy()
      delete globalSlot()[GLOBAL_KEY]
    },
  }

  globalSlot()[GLOBAL_KEY] = instance
  if (options.autoStart !== false) controller.start()
  return instance
}

export function getStreamLens(): StreamLensInstance | undefined {
  if (typeof window === 'undefined') return undefined
  return globalSlot()[GLOBAL_KEY] as StreamLensInstance | undefined
}
