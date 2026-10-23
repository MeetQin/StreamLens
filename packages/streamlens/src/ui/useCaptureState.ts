import { onMounted, onUnmounted, shallowRef, type ShallowRef } from 'vue'
import type { CaptureController, CaptureSnapshot } from '../runtime/controller.js'

export function useCaptureState(
  controller: CaptureController,
): ShallowRef<CaptureSnapshot> {
  const state = shallowRef(controller.getSnapshot())
  let unsubscribe: (() => void) | undefined

  onMounted(() => {
    state.value = controller.getSnapshot()
    unsubscribe = controller.subscribe(() => {
      state.value = controller.getSnapshot()
    })
  })

  onUnmounted(() => {
    unsubscribe?.()
    unsubscribe = undefined
  })

  return state
}
