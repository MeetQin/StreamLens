import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface VirtualListOptions {
  itemHeight: number
  overscan?: number
}

export function useVirtualList<T>(
  items: Ref<T[]>,
  scrollContainer: Ref<HTMLElement | null>,
  options: VirtualListOptions,
) {
  const scrollTop = ref(0)
  const viewportHeight = ref(400)
  const overscan = options.overscan ?? 6

  function onScroll(): void {
    const el = scrollContainer.value
    if (!el) return
    scrollTop.value = el.scrollTop
  }

  function measure(): void {
    const el = scrollContainer.value
    if (el) viewportHeight.value = el.clientHeight
  }

  onMounted(() => {
    measure()
    scrollContainer.value?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
  })

  onUnmounted(() => {
    scrollContainer.value?.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', measure)
  })

  const totalHeight = computed(() => items.value.length * options.itemHeight)

  const visibleRange = computed(() => {
    const start = Math.floor(scrollTop.value / options.itemHeight)
    const visible = Math.ceil(viewportHeight.value / options.itemHeight)
    const from = Math.max(0, start - overscan)
    const to = Math.min(items.value.length, start + visible + overscan)
    return { from, to }
  })

  const visibleItems = computed(() => {
    const { from, to } = visibleRange.value
    return items.value.slice(from, to).map((item, i) => ({
      item,
      index: from + i,
    }))
  })

  const offsetY = computed(() => visibleRange.value.from * options.itemHeight)

  return {
    totalHeight,
    visibleItems,
    offsetY,
    onScroll,
    measure,
  }
}
