<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StreamEvent, StreamRequest } from '@streamlens/protocol'
import CaptureToolbar from './components/CaptureToolbar.vue'
import EventDetail from './components/EventDetail.vue'
import EventTimeline from './components/EventTimeline.vue'
import ParseErrorsPanel from './components/ParseErrorsPanel.vue'
import RawStreamPanel from './components/RawStreamPanel.vue'
import RequestList from './components/RequestList.vue'
import RequestOverview from './components/RequestOverview.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useStreamLensPort } from './composables/useStreamLensPort'

const {
  tabId,
  sessionId,
  captureStatus,
  captureError,
  navigationHint,
  cdpHint,
  requests,
  eventsByRequest,
  startCapture,
  stopCapture,
  clearAll,
  exportRequest,
  exportAll,
  exportHar,
  exportRequestHar,
  getMetrics,
  getExportPreview,
  settings,
  saveSettings,
} = useStreamLensPort()

const urlFilter = ref('')
const stateFilter = ref<string>('all')
const sourceFilter = ref<string>('all')
const searchText = ref('')
const detailTab = ref<'events' | 'raw' | 'errors'>('events')
const settingsOpen = ref(false)

const selectedRequestId = ref<string | null>(null)
const selectedEventId = ref<string | null>(null)

const filteredRequests = computed(() => {
  let list = requests.value
  const q = urlFilter.value.trim().toLowerCase()
  if (q) list = list.filter((r) => r.url.toLowerCase().includes(q))
  if (stateFilter.value !== 'all') {
    list = list.filter((r) => r.state === stateFilter.value)
  }
  if (sourceFilter.value !== 'all') {
    list = list.filter((r) => r.source === sourceFilter.value)
  }
  const s = searchText.value.trim().toLowerCase()
  if (s) {
    list = list.filter((r) => {
      if (r.url.toLowerCase().includes(s)) return true
      const evs = eventsByRequest.value[r.id] ?? []
      return evs.some(
        (e) => (e.eventType ?? '').toLowerCase().includes(s) || e.data.toLowerCase().includes(s),
      )
    })
  }
  return list
})

const selectedRequest = computed(
  () =>
    filteredRequests.value.find((r) => r.id === selectedRequestId.value) ??
    requests.value.find((r) => r.id === selectedRequestId.value) ??
    null,
)

const selectedEvents = computed(() => {
  if (!selectedRequest.value) return [] as StreamEvent[]
  return eventsByRequest.value[selectedRequest.value.id] ?? []
})

const errorEvents = computed(() => selectedEvents.value.filter((e) => !!e.parseError))

const selectedEvent = computed(
  () => selectedEvents.value.find((e) => e.id === selectedEventId.value) ?? null,
)

const lastEventId = computed(() => {
  for (let i = selectedEvents.value.length - 1; i >= 0; i--) {
    const id = selectedEvents.value[i].eventId
    if (id) return id
  }
  return undefined
})

function onSelectRequest(r: StreamRequest): void {
  selectedRequestId.value = r.id
  selectedEventId.value = null
  detailTab.value = 'events'
}

function onSelectEvent(e: StreamEvent): void {
  selectedEventId.value = e.id
  detailTab.value = 'events'
}

async function handleExportAll(): Promise<void> {
  const preview = getExportPreview()
  const redactNote = settings.value?.redactOnExport !== false ? '将尝试脱敏' : '未启用脱敏'
  const ok = confirm(
    `将导出 ${preview.requestCount} 条请求、${preview.eventCount} 条事件（${redactNote}）。仍可能包含业务敏感内容，是否继续？`,
  )
  if (!ok) return
  const data = await exportAll()
  downloadJson(data, `streamlens-export-${Date.now()}.json`)
}

async function handleExportAllText(): Promise<void> {
  const preview = getExportPreview()
  const ok = confirm(`导出 ${preview.eventCount} 条事件的 JSONL 文本？`)
  if (!ok) return
  const data = await exportAll()
  if (!Array.isArray(data)) return
  const lines = (data as Array<{ events: StreamEvent[] }>).flatMap((r) =>
    r.events.map((e) => JSON.stringify(e)),
  )
  downloadBlob(lines.join('\n'), `streamlens-${Date.now()}.jsonl`, 'application/x-ndjson')
}

async function handleExportHar(): Promise<void> {
  const ok = confirm('导出 HAR 1.2（含 _streamlens 扩展字段）？可能包含敏感响应体。')
  if (!ok) return
  const data = await exportHar()
  downloadJson(data, `streamlens-${Date.now()}.har`)
}

async function handleExportRequestHar(): Promise<void> {
  if (!selectedRequest.value) return
  const ok = confirm('导出当前请求的 HAR？')
  if (!ok) return
  const data = await exportRequestHar(selectedRequest.value.id)
  downloadJson(data, `streamlens-${selectedRequest.value.id}.har`)
}

async function handleExportRequest(): Promise<void> {
  if (!selectedRequest.value) return
  const evCount = selectedEvents.value.length
  const ok = confirm(`将导出 1 条请求、${evCount} 条事件。仍可能包含敏感内容，是否继续？`)
  if (!ok) return
  const data = await exportRequest(selectedRequest.value.id)
  downloadJson(data, `streamlens-${selectedRequest.value.id}.json`)
}

function downloadJson(data: unknown, filename: string): void {
  if (data == null) return
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json')
}

function downloadBlob(text: string, filename: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function handleClear(): void {
  if (!confirm('清空当前会话的全部请求与事件？')) return
  clearAll()
  selectedRequestId.value = null
  selectedEventId.value = null
}
</script>

<template>
  <div class="layout">
    <CaptureToolbar
      :tab-id="tabId"
      :session-id="sessionId"
      :status="captureStatus"
      :error="captureError"
      :navigation-hint="navigationHint"
      :cdp-hint="cdpHint"
      :can-export-request="!!selectedRequest"
      @start="startCapture"
      @stop="stopCapture"
      @clear="handleClear"
      @export-all="handleExportAll"
      @export-all-text="handleExportAllText"
      @export-har="handleExportHar"
      @export-request="handleExportRequest"
      @export-request-har="handleExportRequestHar"
      @open-settings="settingsOpen = true"
    />

    <SettingsPanel
      :open="settingsOpen"
      :settings="settings"
      @close="settingsOpen = false"
      @save="saveSettings"
    />

    <div class="filters">
      <input v-model="searchText" placeholder="搜索 URL / 事件类型 / 内容" />
      <input v-model="urlFilter" placeholder="URL 过滤" />
      <select v-model="stateFilter">
        <option value="all">全部状态</option>
        <option value="pending">pending</option>
        <option value="streaming">streaming</option>
        <option value="completed">completed</option>
        <option value="failed">failed</option>
        <option value="aborted">aborted</option>
      </select>
      <select v-model="sourceFilter">
        <option value="all">全部类型</option>
        <option value="fetch-stream">fetch-stream</option>
        <option value="event-source">event-source</option>
      </select>
    </div>

    <div class="main">
      <RequestList
        class="col-list"
        :requests="filteredRequests"
        :selected-id="selectedRequestId"
        @select="onSelectRequest"
      />
      <div class="col-detail">
        <RequestOverview
          v-if="selectedRequest"
          :request="selectedRequest"
          :metrics="getMetrics(selectedRequest)"
          :last-event-id="lastEventId"
        />
        <p v-else class="empty">选择一条请求查看详情</p>

        <div v-if="selectedRequest" class="tabs">
          <button
            type="button"
            :class="{ active: detailTab === 'events' }"
            @click="detailTab = 'events'"
          >
            Events
          </button>
          <button type="button" :class="{ active: detailTab === 'raw' }" @click="detailTab = 'raw'">
            Raw
          </button>
          <button
            type="button"
            :class="{ active: detailTab === 'errors' }"
            @click="detailTab = 'errors'"
          >
            Errors ({{ errorEvents.length }})
          </button>
        </div>

        <template v-if="detailTab === 'events'">
          <EventTimeline
            :events="selectedEvents"
            :selected-id="selectedEventId"
            @select="onSelectEvent"
          />
          <EventDetail :event="selectedEvent" />
        </template>
        <RawStreamPanel v-else-if="detailTab === 'raw'" :events="selectedEvents" />
        <ParseErrorsPanel v-else :events="errorEvents" @select="onSelectEvent" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.filters {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--sl-border);
  flex-wrap: wrap;
}

.filters input {
  flex: 1;
  min-width: 140px;
}

.main {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(220px, 34%) 1fr;
  min-height: 0;
}

.col-list {
  border-right: 1px solid var(--sl-border);
  min-height: 0;
}

.col-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--sl-border);
}

.tabs button {
  border-radius: 4px 4px 0 0;
}

.tabs button.active {
  background: color-mix(in srgb, var(--sl-accent) 15%, transparent);
  border-bottom-color: transparent;
}

.empty {
  padding: 12px;
  color: var(--sl-muted);
  margin: 0;
}
</style>
