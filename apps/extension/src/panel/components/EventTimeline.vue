<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import type { StreamEvent } from '@streamlens/protocol'
import { useVirtualList } from '../composables/useVirtualList'

const props = defineProps<{
  events: StreamEvent[]
  selectedId: string | null
}>()

defineEmits<{
  select: [event: StreamEvent]
}>()

const ITEM_HEIGHT = 32
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
  <section class="timeline">
    <h3>事件时间线 ({{ events.length }})</h3>
    <div ref="scrollEl" class="scroll">
      <div v-if="!events.length" class="empty">尚无事件</div>
      <div v-else class="virtual-outer" :style="{ height: `${totalHeight}px` }">
        <div class="virtual-inner" :style="{ transform: `translateY(${offsetY}px)` }">
          <button
            v-for="{ item: e } in visibleItems"
            :key="e.id"
            type="button"
            class="row"
            :class="{ active: e.id === selectedId, error: !!e.parseError }"
            :style="{ height: `${ITEM_HEIGHT}px` }"
            @click="$emit('select', e)"
          >
            <span class="idx">#{{ e.index }}</span>
            <span class="type">{{ e.streamEndMarker ? 'stream-end' : (e.eventType || 'message') }}</span>
            <span class="preview">{{ e.data.slice(0, 80) }}{{ e.data.length > 80 ? '…' : '' }}</span>
            <span v-if="e.truncated" class="tag">truncated</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.timeline {
  padding: 8px 12px;
  border-bottom: 1px solid var(--sl-border);
  flex: 0 0 auto;
  max-height: 40%;
  display: flex;
  flex-direction: column;
  min-height: 120px;
}

h3 {
  margin: 0 0 6px;
  font-size: 13px;
}

.scroll {
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.virtual-outer {
  position: relative;
  width: 100%;
}

.virtual-inner {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
}

.row {
  display: grid;
  grid-template-columns: 48px 80px 1fr auto;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 4px 6px;
  border: none;
  border-bottom: 1px solid var(--sl-border);
  border-radius: 0;
  background: transparent;
  align-items: center;
  box-sizing: border-box;
}

.row.active {
  background: color-mix(in srgb, var(--sl-accent) 12%, transparent);
}

.row.error .preview {
  color: var(--sl-danger);
}

.idx {
  color: var(--sl-muted);
}

.type {
  font-weight: 600;
}

.preview {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  font-size: 10px;
  color: var(--sl-muted);
}

.empty {
  color: var(--sl-muted);
}
</style>
