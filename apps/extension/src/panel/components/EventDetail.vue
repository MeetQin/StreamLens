<script setup lang="ts">
import type { StreamEvent } from '@streamlens/protocol'
import JsonViewer from './JsonViewer.vue'

const props = defineProps<{
  event: StreamEvent | null
}>()

async function copyRaw(): Promise<void> {
  if (!props.event) return
  await navigator.clipboard.writeText(props.event.data)
}
</script>

<template>
  <section class="detail">
    <template v-if="event">
      <div class="head">
        <h3>事件 #{{ event.index }}</h3>
        <button type="button" @click="copyRaw">Copy raw</button>
      </div>
      <p class="meta">
        {{ new Date(event.timestamp).toLocaleTimeString() }} ·
        {{ event.eventType || 'message' }}
        <span v-if="event.eventId">· id={{ event.eventId }}</span>
      </p>
      <div v-if="event.parseError" class="err">JSON 解析错误: {{ event.parseError }}</div>
      <h4>Raw data</h4>
      <pre class="mono block">{{ event.data }}</pre>
      <h4 v-if="event.parsedData !== undefined">JSON</h4>
      <JsonViewer v-if="event.parsedData !== undefined" :value="event.parsedData" />
      <h4 v-if="event.normalizedData !== undefined">
        Adapter{{ event.adapterId ? ` (${event.adapterId})` : '' }}
      </h4>
      <JsonViewer v-if="event.normalizedData !== undefined" :value="event.normalizedData" />
    </template>
    <p v-else class="empty">选择一条事件查看原始内容与 JSON</p>
  </section>
</template>

<style scoped>
.detail {
  padding: 10px 12px;
  flex: 1;
  overflow: auto;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h3,
h4 {
  margin: 8px 0 4px;
  font-size: 14px;
}

.meta {
  margin: 0;
  color: var(--sl-muted);
  font-size: 13px;
}

.block {
  margin: 0;
  padding: 8px;
  background: var(--sl-surface);
  border: 1px solid var(--sl-border);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
}

.err {
  color: var(--sl-danger);
  margin: 6px 0;
}

.empty {
  color: var(--sl-muted);
}
</style>
