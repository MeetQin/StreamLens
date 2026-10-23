<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import type { StreamRequest } from '@streamlens/protocol'
import { useVirtualList } from '../composables/useVirtualList'
import { fmtDuration } from '../format'

const props = defineProps<{
  requests: StreamRequest[]
  selectedId: string | null
}>()

defineEmits<{
  select: [request: StreamRequest]
}>()

const ITEM_HEIGHT = 80
const scrollEl = ref<HTMLElement | null>(null)
const itemsRef = toRef(props, 'requests')
const { totalHeight, visibleItems, offsetY, measure } = useVirtualList(
  itemsRef,
  scrollEl,
  { itemHeight: ITEM_HEIGHT, overscan: 8 },
)

watch(itemsRef, () => measure(), { flush: 'post' })

const stateLabel: Record<StreamRequest['state'], string> = {
  pending: 'pending',
  streaming: 'streaming',
  completed: 'completed',
  failed: 'failed',
  aborted: 'aborted',
}
</script>

<template>
  <div ref="scrollEl" class="sl-req-list">
    <p v-if="!requests.length" class="sl-empty">
      暂无请求。在页面中发起 SSE / 流式 fetch 后会出现在这里。
    </p>
    <div v-else class="sl-virtual-outer" :style="{ height: `${totalHeight}px` }">
      <div class="sl-virtual-inner" :style="{ transform: `translateY(${offsetY}px)` }">
        <button
          v-for="{ item: r } in visibleItems"
          :key="r.id"
          type="button"
          class="sl-req"
          :class="{ 'is-active': r.id === selectedId, 'is-failed': r.state === 'failed' }"
          @click="$emit('select', r)"
        >
          <div class="sl-req-top">
            <span class="sl-method">{{ r.method }}</span>
            <span
              class="sl-code"
              :class="{
                'is-ok': r.status !== undefined && r.status < 400,
                'is-bad': r.status !== undefined && r.status >= 400,
              }"
            >
              {{ r.status ?? '···' }}
            </span>
            <span class="sl-state" :class="`is-${r.state}`">{{ stateLabel[r.state] }}</span>
            <span class="sl-source">
              {{ r.source === 'fetch-stream' ? 'fetch' : 'EventSource' }}
            </span>
            <span class="sl-spacer" />
            <span class="sl-count">{{ r.eventCount }} ev</span>
          </div>
          <div class="sl-req-url" :title="r.url">{{ r.url }}</div>
          <div class="sl-req-meta">
            <span>{{ fmtDuration(r.startedAt, r.endedAt) }}</span>
            <span v-if="r.firstEventAt !== undefined">
              首包 {{ r.firstEventAt - r.startedAt }} ms
            </span>
            <span v-if="r.parseErrorCount" class="sl-bad">
              {{ r.parseErrorCount }} 解析错误
            </span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
