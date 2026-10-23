<script setup lang="ts">
import type { StreamRequest } from '@streamlens/protocol'
import { fmtMs, fmtTime } from '../format'

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
  <section class="sl-overview">
    <div class="sl-overview-head">
      <span class="sl-method">{{ request.method }}</span>
      <span
        class="sl-code"
        :class="{
          'is-ok': request.status !== undefined && request.status < 400,
          'is-bad': request.status !== undefined && request.status >= 400,
        }"
      >
        {{ request.status ?? '-' }}
      </span>
      <span class="sl-url" :title="request.url">{{ request.url }}</span>
      <button type="button" class="sl-btn sl-btn--small" @click="copySummary">复制摘要</button>
    </div>
    <div class="sl-metrics">
      <div class="sl-metric">
        <span class="sl-metric-label">状态</span>
        <span class="sl-metric-value">{{ request.state }}</span>
      </div>
      <div class="sl-metric">
        <span class="sl-metric-label">首包</span>
        <span class="sl-metric-value">{{ fmtMs(metrics.firstEventLatencyMs) }}</span>
      </div>
      <div class="sl-metric">
        <span class="sl-metric-label">总耗时</span>
        <span class="sl-metric-value">{{ fmtMs(metrics.totalDurationMs) }}</span>
      </div>
      <div class="sl-metric">
        <span class="sl-metric-label">事件</span>
        <span class="sl-metric-value">{{ metrics.eventCount }}</span>
      </div>
      <div class="sl-metric">
        <span class="sl-metric-label">平均间隔</span>
        <span class="sl-metric-value">{{ fmtMs(metrics.avgEventIntervalMs) }}</span>
      </div>
      <div class="sl-metric">
        <span class="sl-metric-label">最大间隔</span>
        <span class="sl-metric-value">{{ fmtMs(metrics.maxEventIntervalMs) }}</span>
      </div>
      <div class="sl-metric">
        <span class="sl-metric-label">解析错误</span>
        <span class="sl-metric-value" :class="{ 'sl-bad': metrics.parseErrorCount > 0 }">
          {{ metrics.parseErrorCount }}
        </span>
      </div>
      <div class="sl-metric">
        <span class="sl-metric-label">开始</span>
        <span class="sl-metric-value">{{ fmtTime(request.startedAt) }}</span>
      </div>
      <div v-if="lastEventId" class="sl-metric">
        <span class="sl-metric-label">Last-Event-ID</span>
        <span class="sl-metric-value sl-mono">{{ lastEventId }}</span>
      </div>
    </div>
    <p v-if="request.errorMessage" class="sl-error-text">{{ request.errorMessage }}</p>
  </section>
</template>
