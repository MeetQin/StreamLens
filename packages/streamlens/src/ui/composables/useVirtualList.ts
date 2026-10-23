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

  const visibleItems = computed(() => {
    const start = Math.max(
      0,
      Math.floor(scrollTop.value / options.itemHeight) - overscan,
    )
    const end = Math.min(
      items.value.length,
      Math.ceil((scrollTop.value + viewportHeight.value) / options.itemHeight) + overscan,
    )
    return items.value.slice(start, end).map((item, index) => ({
      item,
      index: start + index,
    }))
  })

  const offsetY = computed(() => {
    const first = visibleItems.value[0]
    return first ? first.index * options.itemHeight : 0
  })

  return { totalHeight, visibleItems, offsetY, measure }
}
