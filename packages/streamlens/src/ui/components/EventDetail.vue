<script setup lang="ts">
import type { StreamEvent } from '@streamlens/protocol'
import JsonViewer from './JsonViewer.vue'
import { fmtTime } from '../format'

const props = defineProps<{
  event: StreamEvent | null
}>()

async function copyRaw(): Promise<void> {
  if (!props.event) return
  await navigator.clipboard.writeText(props.event.data)
}
</script>

<template>
  <section class="sl-detail">
    <template v-if="event">
      <div class="sl-detail-head">
        <h3>事件 #{{ event.index }}</h3>
        <button type="button" class="sl-btn sl-btn--small" @click="copyRaw">复制原文</button>
      </div>
      <p class="sl-meta">
        {{ fmtTime(event.timestamp) }} · {{ event.eventType || 'message' }}
        <span v-if="event.eventId"> · id={{ event.eventId }}</span>
        <span v-if="event.adapterId"> · {{ event.adapterId }}</span>
      </p>
      <p v-if="event.truncated" class="sl-warn">事件内容超过大小上限，已截断。</p>
      <p v-if="event.parseError" class="sl-error-text">JSON 解析错误: {{ event.parseError }}</p>
      <h4>原始数据</h4>
      <pre class="sl-mono sl-pre">{{ event.data }}</pre>
      <template v-if="event.parsedData !== undefined">
        <h4>JSON</h4>
        <JsonViewer :value="event.parsedData" />
      </template>
      <template v-if="event.normalizedData !== undefined">
        <h4>适配器输出{{ event.adapterId ? ` (${event.adapterId})` : '' }}</h4>
        <JsonViewer :value="event.normalizedData" />
      </template>
    </template>
    <p v-else class="sl-empty">选择一条事件查看原始内容与 JSON</p>
  </section>
</template>
