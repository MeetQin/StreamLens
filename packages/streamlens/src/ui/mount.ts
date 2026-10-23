import { createApp, type ComponentPublicInstance } from 'vue'
import PanelRoot from './PanelRoot.vue'
import uiCss from './styles.css?inline'
import type { CaptureController } from '../runtime/controller.js'
import type { StreamLensOptions } from '../types.js'

export interface PanelHandle {
  open(): void
  close(): void
  destroy(): void
}

interface PanelExposed extends ComponentPublicInstance {
  openPanel(): void
  closePanel(): void
}

export function mountPanel(
  controller: CaptureController,
  options: StreamLensOptions,
): PanelHandle {
  const host = document.createElement('div')
  host.setAttribute('data-streamlens-root', '')
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'inset: 0',
    'pointer-events: none',
    `z-index: ${options.zIndex ?? 2147483647}`,
  ].join(';')

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = uiCss
  shadow.appendChild(style)

  const container = document.createElement('div')
  container.className = 'sl-root'
  if (options.theme === 'light' || options.theme === 'dark') {
    container.classList.add(`sl-theme-${options.theme}`)
  }
  shadow.appendChild(container)
  document.documentElement.appendChild(host)

  const app = createApp(PanelRoot, { controller, options })
  app.config.errorHandler = (error) => {
    console.error('[StreamLens]', error)
  }
  const instance = app.mount(container) as PanelExposed

  return {
    open: () => instance.openPanel(),
    close: () => instance.closePanel(),
    destroy: () => {
      app.unmount()
      host.remove()
    },
  }
}
