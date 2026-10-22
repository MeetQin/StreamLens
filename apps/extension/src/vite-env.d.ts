/// <reference types="vite/client" />

declare const __STREAMLENS_E2E__: boolean

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
