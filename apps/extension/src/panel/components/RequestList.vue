<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import type { StreamRequest } from '@streamlens/protocol'
import { useVirtualList } from '../composables/useVirtualList'

const props = defineProps<{
  requests: StreamRequest[]
  selectedId: string | null
}>()

defineEmits<{
  select: [request: StreamRequest]
}>()

const ITEM_HEIGHT = 72
const scrollEl = ref<HTMLElement | null>(null)
const itemsRef = toRef(props, 'requests')

const { totalHeight, visibleItems, offsetY, measure } = useVirtualList(
  itemsRef,
  scrollEl,
  { itemHeight: ITEM_HEIGHT, overscan: 8 },
)

watch(itemsRef, () => measure(), { flush: 'post' })

function stateClass(state: StreamRequest['state']): string {
  return `state-${state}`
}
</script>

<template>
  <div ref="scrollEl" class="list">
    <div v-if="!requests.length" class="empty">暂无请求。开启采集并在页面中发起 SSE / 流式 fetch。</div>
    <div v-else class="virtual-outer" :style="{ height: `${totalHeight}px` }">
      <div class="virtual-inner" :style="{ transform: `translateY(${offsetY}px)` }">
        <button
          v-for="{ item: r } in visibleItems"
          :key="r.id"
          type="button"
          class="item"
          :class="{ active: r.id === selectedId }"
          :style="{ height: `${ITEM_HEIGHT}px` }"
          @click="$emit('select', r)"
        >
          <div class="row">
            <span class="method">{{ r.method }}</span>
            <span :class="['state', stateClass(r.state)]">{{ r.state }}</span>
          </div>
          <div class="url" :title="r.url">{{ r.url }}</div>
          <div class="meta">
            <span>{{ r.source }}</span>
            <span v-if="r.status">· {{ r.status }}</span>
            <span>· {{ r.eventCount }} events</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list {
  overflow: auto;
  height: 100%;
}

.empty {
  padding: 12px;
  color: var(--sl-muted);
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

.item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  border-bottom: 1px solid var(--sl-border);
  border-radius: 0;
  padding: 8px 10px;
  background: transparent;
  box-sizing: border-box;
}

.item:hover {
  background: color-mix(in srgb, var(--sl-accent) 8%, transparent);
}

.item.active {
  background: color-mix(in srgb, var(--sl-accent) 15%, transparent);
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.method {
  font-weight: 600;
}

.state {
  font-size: 11px;
  text-transform: uppercase;
}

.state-streaming {
  color: var(--sl-accent);
}

.state-completed {
  color: var(--sl-ok);
}

.state-failed,
.state-aborted {
  color: var(--sl-danger);
}

.url {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
}

.meta {
  font-size: 11px;
  color: var(--sl-muted);
  margin-top: 4px;
}
</style>
