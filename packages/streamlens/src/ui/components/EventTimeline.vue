<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import type { StreamEvent } from '@streamlens/protocol'
import { useVirtualList } from '../composables/useVirtualList'
import { fmtTime, previewText } from '../format'

const props = defineProps<{
  events: StreamEvent[]
  selectedId: string | null
}>()

defineEmits<{
  select: [event: StreamEvent]
}>()

const ITEM_HEIGHT = 34
const scrollEl = ref<HTMLElement | null>(null)
const itemsRef = toRef(props, 'events')
const { totalHeight, visibleItems, offsetY, measure } = useVirtualList(
  itemsRef,
  scrollEl,
  { itemHeight: ITEM_HEIGHT, overscan: 12 },
)

watch(itemsRef, () => measure(), { flush: 'post' })
</script>

<template>
  <section class="sl-timeline">
    <div class="sl-section-head">
      <h3>事件时间线</h3>
      <span class="sl-muted">{{ events.length }} 条</span>
    </div>
    <div ref="scrollEl" class="sl-scroll">
      <p v-if="!events.length" class="sl-empty">尚无事件</p>
      <div v-else class="sl-virtual-outer" :style="{ height: `${totalHeight}px` }">
        <div class="sl-virtual-inner" :style="{ transform: `translateY(${offsetY}px)` }">
          <button
            v-for="{ item: e } in visibleItems"
            :key="e.id"
            type="button"
            class="sl-ev"
            :class="{ 'is-active': e.id === selectedId, 'is-error': !!e.parseError }"
            @click="$emit('select', e)"
          >
            <span class="sl-ev-index">#{{ e.index }}</span>
            <span class="sl-ev-type" :class="{ 'is-end': e.streamEndMarker }">
              {{ e.streamEndMarker ? 'stream-end' : e.eventType || 'message' }}
            </span>
            <span class="sl-ev-data">{{ previewText(e.data, 90) }}</span>
            <span class="sl-ev-time">{{ fmtTime(e.timestamp) }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
