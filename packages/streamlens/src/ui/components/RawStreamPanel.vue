<script setup lang="ts">
import { computed } from 'vue'
import type { StreamEvent } from '@streamlens/protocol'

const props = defineProps<{
  events: StreamEvent[]
}>()

const raw = computed(() =>
  props.events
    .map((event) => `#${event.index}\t${event.eventType ?? 'message'}\t${event.data}`)
    .join('\n'),
)

async function copyAll(): Promise<void> {
  await navigator.clipboard.writeText(raw.value)
}
</script>

<template>
  <section class="sl-raw">
    <div class="sl-section-head">
      <h3>Raw 事件流</h3>
      <button type="button" class="sl-btn sl-btn--small" :disabled="!events.length" @click="copyAll">
        复制全部
      </button>
    </div>
    <pre class="sl-mono sl-pre sl-pre--fill">{{ raw || '（无事件）' }}</pre>
  </section>
</template>
