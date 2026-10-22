<script setup lang="ts">
import type { StreamRequest } from '@streamlens/protocol'

const props = defineProps<{
  request: StreamRequest
  metrics: {
    firstEventLatencyMs?: number
    totalDurationMs?: number
    eventCount: number
    parseErrorCount: number
    avgEventIntervalMs?: number
    maxEventIntervalMs?: number
  }
  lastEventId?: string
}>()

function fmtMs(v?: number): string {
  if (v === undefined) return '-'
  return `${v} ms`
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

async function copySummary(): Promise<void> {
  const r = props.request
  const m = props.metrics
  const text = [
    r.url,
    `${r.method} ${r.status ?? '-'} ${r.state}`,
    `events=${m.eventCount} parseErrors=${m.parseErrorCount}`,
    `firstEvent=${fmtMs(m.firstEventLatencyMs)} total=${fmtMs(m.totalDurationMs)}`,
  ].join('\n')
  await navigator.clipboard.writeText(text)
}
</script>

<template>
  <section class="overview">
    <div class="head">
      <h3>请求概览</h3>
      <button type="button" @click="copySummary">Copy summary</button>
    </div>
    <dl>
      <dt>URL</dt>
      <dd class="mono">{{ request.url }}</dd>
      <dt>Method / Status</dt>
      <dd>{{ request.method }} · {{ request.status ?? '-' }}</dd>
      <dt>Content-Type</dt>
      <dd>{{ request.contentType ?? '-' }}</dd>
      <dt>Source</dt>
      <dd>{{ request.source }}</dd>
      <dt v-if="lastEventId">Last-Event-ID</dt>
      <dd v-if="lastEventId">{{ lastEventId }}</dd>
      <dt>Started</dt>
      <dd>{{ fmtTime(request.startedAt) }}</dd>
      <dt>State</dt>
      <dd>{{ request.state }} <span v-if="request.finishReason">({{ request.finishReason }})</span></dd>
      <dt v-if="request.errorMessage">Error</dt>
      <dd v-if="request.errorMessage" class="err">{{ request.errorMessage }}</dd>
      <dt>首事件延迟</dt>
      <dd>{{ fmtMs(metrics.firstEventLatencyMs) }}</dd>
      <dt>总耗时</dt>
      <dd>{{ fmtMs(metrics.totalDurationMs) }}</dd>
      <dt>事件数 / 解析失败</dt>
      <dd>{{ metrics.eventCount }} / {{ metrics.parseErrorCount }}</dd>
      <dt>平均 / 最大事件间隔</dt>
      <dd>{{ fmtMs(metrics.avgEventIntervalMs) }} / {{ fmtMs(metrics.maxEventIntervalMs) }}</dd>
    </dl>
  </section>
</template>

<style scoped>
.overview {
  padding: 10px 12px;
  border-bottom: 1px solid var(--sl-border);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

h3 {
  margin: 0;
  font-size: 13px;
}

dl {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 4px 8px;
  margin: 0;
}

dt {
  color: var(--sl-muted);
}

dd {
  margin: 0;
  word-break: break-all;
}

.err {
  color: var(--sl-danger);
}
</style>
