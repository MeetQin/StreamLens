<script setup lang="ts">
import type { CaptureStatus } from '../composables/useStreamLensPort'

defineProps<{
  tabId: number | null
  sessionId: string
  status: CaptureStatus
  error: string | null
  navigationHint: string | null
  cdpHint: string | null
  canExportRequest: boolean
}>()

defineEmits<{
  start: []
  stop: []
  clear: []
  exportAll: []
  exportAllText: []
  exportHar: []
  exportRequest: []
  exportRequestHar: []
  openSettings: []
}>()

const statusLabel: Record<CaptureStatus, string> = {
  idle: '未启动',
  capturing: '采集中',
  stopped: '已停止',
  error: '错误',
}
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <strong>StreamLens</strong>
      <span class="meta">Tab {{ tabId ?? '-' }} · {{ sessionId || '-' }}</span>
    </div>
    <div class="actions">
      <button class="primary" :disabled="status === 'capturing'" @click="$emit('start')">
        Start Capture
      </button>
      <button :disabled="status !== 'capturing'" @click="$emit('stop')">Stop</button>
      <button @click="$emit('clear')">Clear</button>
      <button :disabled="!canExportRequest" @click="$emit('exportRequest')">Export Request</button>
      <button @click="$emit('exportAll')">Export JSON</button>
      <button @click="$emit('exportAllText')">Export JSONL</button>
      <button @click="$emit('exportHar')">Export HAR</button>
      <button :disabled="!canExportRequest" @click="$emit('exportRequestHar')">HAR Request</button>
      <button @click="$emit('openSettings')">Settings</button>
    </div>
    <div class="status">
      <span :class="['badge', status]">{{ statusLabel[status] }}</span>
      <span v-if="status === 'idle' || status === 'stopped'" class="hint">
        开启采集后刷新页面可捕获加载阶段的请求；刷新后采集会自动延续。
      </span>
      <span v-if="navigationHint" class="hint">{{ navigationHint }}</span>
      <span v-if="cdpHint" class="err">{{ cdpHint }}</span>
      <span v-if="error" class="err">{{ error }}</span>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--sl-border);
  background: var(--sl-surface);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-right: auto;
}

.meta {
  color: var(--sl-muted);
  font-size: 11px;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--sl-border);
}

.badge.capturing {
  background: color-mix(in srgb, var(--sl-ok) 20%, transparent);
  border-color: var(--sl-ok);
}

.badge.error {
  background: color-mix(in srgb, var(--sl-danger) 20%, transparent);
  border-color: var(--sl-danger);
}

.hint {
  color: var(--sl-muted);
  font-size: 12px;
}

.err {
  color: var(--sl-danger);
}
</style>
