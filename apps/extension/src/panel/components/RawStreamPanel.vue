<script setup lang="ts">
import type { StreamEvent } from '@streamlens/protocol'
import { computed } from 'vue'

const props = defineProps<{
  events: StreamEvent[]
}>()

const raw = computed(() =>
  props.events.map((e) => `#${e.index}\t${e.eventType ?? 'message'}\t${e.data}`).join('\n'),
)

async function copyAll(): Promise<void> {
  await navigator.clipboard.writeText(raw.value)
}
</script>

<template>
  <section class="raw">
    <div class="head">
      <h3>Raw 事件流</h3>
      <button type="button" :disabled="!events.length" @click="copyAll">Copy all</button>
    </div>
    <pre class="mono">{{ raw || '（无事件）' }}</pre>
  </section>
</template>

<style scoped>
.raw {
  padding: 10px 12px;
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h3 {
  margin: 0;
  font-size: 14px;
}

pre {
  flex: 1;
  overflow: auto;
  margin: 8px 0 0;
  padding: 8px;
  background: var(--sl-surface);
  border: 1px solid var(--sl-border);
  border-radius: 4px;
  white-space: pre-wrap;
  font-size: 13px;
}
</style>
