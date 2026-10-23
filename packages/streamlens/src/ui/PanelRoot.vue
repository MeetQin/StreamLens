<script setup lang="ts">
import { computed, ref } from 'vue'
import { computeMetrics } from '@streamlens/core'
import type { StreamEvent, StreamRequest } from '@streamlens/protocol'
import type { CaptureController } from '../runtime/controller.js'
import type { StreamLensOptions } from '../types.js'
import { useCaptureState } from './useCaptureState'
import RequestList from './components/RequestList.vue'
import RequestOverview from './components/RequestOverview.vue'
import EventTimeline from './components/EventTimeline.vue'
import EventDetail from './components/EventDetail.vue'
import RawStreamPanel from './components/RawStreamPanel.vue'
import ParseErrorsPanel from './components/ParseErrorsPanel.vue'
import SettingsPanel, { type InPageSettings } from './components/SettingsPanel.vue'

const props = defineProps<{
  controller: CaptureController
  options: StreamLensOptions
}>()

const state = useCaptureState(props.controller)
const open = ref(props.options.open === true)
const position = props.options.position ?? 'bottom-right'
const settingsOpen = ref(false)
const settings = ref<InPageSettings>({
  enableAiAdapter: props.options.enableAiAdapter ?? true,
  redactOnExport: props.options.redactOnExport ?? true,
})

const urlFilter = ref('')
const stateFilter = ref('all')
const sourceFilter = ref('all')
const searchText = ref('')
const detailTab = ref<'events' | 'raw' | 'errors'>('events')
const selectedRequestId = ref<string | null>(null)
const selectedEventId = ref<string | null>(null)

const sessionId = computed(() => props.controller.getSessionId())
const shortSession = computed(() =>
  sessionId.value.length > 22 ? `${sessionId.value.slice(0, 22)}…` : sessionId.value,
)
const totalEvents = computed(() =>
  state.value.requests.reduce((sum, request) => sum + request.eventCount, 0),
)
const statusLabel = computed(() => (state.value.capturing ? '采集中' : '已暂停'))

const filteredRequests = computed(() => {
  let list = state.value.requests
  const urlQuery = urlFilter.value.trim().toLowerCase()
  if (urlQuery) list = list.filter((r) => r.url.toLowerCase().includes(urlQuery))
  if (stateFilter.value !== 'all') {
    list = list.filter((r) => r.state === stateFilter.value)
  }
  if (sourceFilter.value !== 'all') {
    list = list.filter((r) => r.source === sourceFilter.value)
  }
  const query = searchText.value.trim().toLowerCase()
  if (query) {
    list = list.filter((r) => {
      if (r.url.toLowerCase().includes(query)) return true
      const events = state.value.eventsByRequest[r.id] ?? []
      return events.some(
        (event) =>
          (event.eventType ?? '').toLowerCase().includes(query) ||
          event.data.toLowerCase().includes(query),
      )
    })
  }
  return list
})

const selectedRequest = computed(
  () =>
    filteredRequests.value.find((r) => r.id === selectedRequestId.value) ??
    state.value.requests.find((r) => r.id === selectedRequestId.value) ??
    null,
)

const selectedEvents = computed(() => {
  if (!selectedRequest.value) return [] as StreamEvent[]
  return state.value.eventsByRequest[selectedRequest.value.id] ?? []
})

const errorEvents = computed(() => selectedEvents.value.filter((event) => !!event.parseError))
const selectedEvent = computed(
  () => selectedEvents.value.find((event) => event.id === selectedEventId.value) ?? null,
)

const lastEventId = computed(() => {
  for (let i = selectedEvents.value.length - 1; i >= 0; i--) {
    const id = selectedEvents.value[i].eventId
    if (id) return id
  }
  return undefined
})

function getMetrics(request: StreamRequest) {
  return computeMetrics(request, state.value.eventsByRequest[request.id] ?? [])
}

function toggleCapture(): void {
  if (state.value.capturing) props.controller.stop()
  else props.controller.start()
}

function handleClear(): void {
  if (!state.value.requests.length) return
  if (!confirm('清空当前会话的全部请求与事件？')) return
  props.controller.clear()
  selectedRequestId.value = null
  selectedEventId.value = null
}

function onSelectRequest(request: StreamRequest): void {
  selectedRequestId.value = request.id
  selectedEventId.value = null
  detailTab.value = 'events'
}

function onSelectEvent(event: StreamEvent): void {
  selectedEventId.value = event.id
  detailTab.value = 'events'
}

function handleExportAll(): void {
  const records = props.controller.exportJson()
  if (!records.length) {
    alert('暂无数据可导出')
    return
  }
  const total = records.reduce((sum, record) => sum + record.events.length, 0)
  const redactNote = settings.value.redactOnExport ? '将尝试脱敏' : '未启用脱敏'
  if (!confirm(`将导出 ${records.length} 条请求、${total} 条事件（${redactNote}）。仍可能包含业务敏感内容，是否继续？`)) {
    return
  }
  downloadJson(records, `streamlens-export-${Date.now()}.json`)
}

function handleExportAllText(): void {
  const records = props.controller.exportJson()
  if (!records.length) {
    alert('暂无数据可导出')
    return
  }
  const total = records.reduce((sum, record) => sum + record.events.length, 0)
  if (!confirm(`导出 ${total} 条事件的 JSONL 文本？`)) return
  const lines = records.flatMap((record) =>
    record.events.map((event) => JSON.stringify(event)),
  )
  downloadBlob(
    lines.join('\n'),
    `streamlens-${Date.now()}.jsonl`,
    'application/x-ndjson',
  )
}

function handleExportHar(): void {
  if (!state.value.requests.length) {
    alert('暂无数据可导出')
    return
  }
  if (!confirm('导出 HAR 1.2（含 _streamlens 扩展字段）？可能包含敏感响应体。')) return
  downloadJson(props.controller.exportHar(), `streamlens-${Date.now()}.har`)
}

function handleExportSelected(): void {
  const request = selectedRequest.value
  if (!request) return
  const record = props.controller.exportRequest(request.id)
  if (!record) return
  if (!confirm(`将导出 1 条请求、${record.events.length} 条事件。仍可能包含敏感内容，是否继续？`)) {
    return
  }
  downloadJson(record, `streamlens-${request.id}.json`)
}

function handleExportSelectedHar(): void {
  const request = selectedRequest.value
  if (!request) return
  const har = props.controller.exportRequestHar(request.id)
  if (!har) return
  if (!confirm('导出当前请求的 HAR？')) return
  downloadJson(har, `streamlens-${request.id}.har`)
}

function downloadJson(data: unknown, filename: string): void {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json')
}

function downloadBlob(text: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function handleSettingsSave(next: InPageSettings): void {
  settings.value = next
  props.controller.configure(next)
  settingsOpen.value = false
}

function openPanel(): void {
  open.value = true
}

function closePanel(): void {
  open.value = false
}

defineExpose({ openPanel, closePanel })
</script>

<template>
  <button
    v-if="!open"
    type="button"
    class="sl-launcher"
    :class="{ 'sl-launcher--left': position === 'bottom-left' }"
    title="打开 StreamLens"
    @click="open = true"
  >
    <span class="sl-logo">SL</span>
    <span class="sl-launcher-label">StreamLens</span>
    <span v-if="totalEvents" class="sl-badge">{{ totalEvents > 999 ? '999+' : totalEvents }}</span>
    <span class="sl-dot" :class="{ 'is-live': state.capturing }" />
  </button>

  <section
    v-else
    class="sl-panel"
    :class="{ 'sl-panel--left': position === 'bottom-left' }"
    aria-label="StreamLens"
  >
    <header class="sl-header">
      <div class="sl-brand">
        <span class="sl-logo">SL</span>
        <div class="sl-brand-copy">
          <strong>StreamLens</strong>
          <span class="sl-session" :title="sessionId">{{ shortSession }}</span>
        </div>
        <span class="sl-status" :class="{ 'is-live': state.capturing }">{{ statusLabel }}</span>
      </div>
      <div class="sl-actions">
        <button type="button" class="sl-btn" @click="toggleCapture">
          {{ state.capturing ? '暂停' : '开始' }}
        </button>
        <button type="button" class="sl-btn" @click="handleClear">清空</button>
        <details class="sl-menu">
          <summary class="sl-btn">导出</summary>
          <div class="sl-menu-panel">
            <button type="button" class="sl-menu-item" @click="handleExportAll">全部 JSON</button>
            <button type="button" class="sl-menu-item" @click="handleExportAllText">
              全部 JSONL
            </button>
            <button type="button" class="sl-menu-item" @click="handleExportHar">全部 HAR</button>
            <button
              type="button"
              class="sl-menu-item"
              :disabled="!selectedRequest"
              @click="handleExportSelected"
            >
              当前请求 JSON
            </button>
            <button
              type="button"
              class="sl-menu-item"
              :disabled="!selectedRequest"
              @click="handleExportSelectedHar"
            >
              当前请求 HAR
            </button>
          </div>
        </details>
        <button type="button" class="sl-btn" @click="settingsOpen = !settingsOpen">设置</button>
        <button type="button" class="sl-btn" title="收起面板" @click="open = false">收起</button>
      </div>
    </header>

    <div class="sl-filters">
      <input v-model="searchText" class="sl-input" placeholder="搜索 URL / 事件类型 / 内容" />
      <input v-model="urlFilter" class="sl-input" placeholder="URL 过滤" />
      <select v-model="stateFilter" class="sl-select">
        <option value="all">全部状态</option>
        <option value="pending">pending</option>
        <option value="streaming">streaming</option>
        <option value="completed">completed</option>
        <option value="failed">failed</option>
        <option value="aborted">aborted</option>
      </select>
      <select v-model="sourceFilter" class="sl-select">
        <option value="all">全部类型</option>
        <option value="fetch-stream">fetch-stream</option>
        <option value="event-source">event-source</option>
      </select>
    </div>

    <div class="sl-main">
      <div class="sl-list-col">
        <RequestList
          :requests="filteredRequests"
          :selected-id="selectedRequestId"
          @select="onSelectRequest"
        />
      </div>
      <div class="sl-detail-col">
        <template v-if="selectedRequest">
          <RequestOverview
            :request="selectedRequest"
            :metrics="getMetrics(selectedRequest)"
            :last-event-id="lastEventId"
          />
          <div class="sl-tabs">
            <button
              type="button"
              class="sl-tab"
              :class="{ 'is-active': detailTab === 'events' }"
              @click="detailTab = 'events'"
            >
              事件
            </button>
            <button
              type="button"
              class="sl-tab"
              :class="{ 'is-active': detailTab === 'raw' }"
              @click="detailTab = 'raw'"
            >
              Raw
            </button>
            <button
              type="button"
              class="sl-tab"
              :class="{ 'is-active': detailTab === 'errors' }"
              @click="detailTab = 'errors'"
            >
              错误 ({{ errorEvents.length }})
            </button>
          </div>
          <div v-if="detailTab === 'events'" class="sl-tab-body">
            <EventTimeline
              :events="selectedEvents"
              :selected-id="selectedEventId"
              @select="onSelectEvent"
            />
            <EventDetail :event="selectedEvent" />
          </div>
          <RawStreamPanel v-else-if="detailTab === 'raw'" :events="selectedEvents" />
          <ParseErrorsPanel v-else :events="errorEvents" @select="onSelectEvent" />
        </template>
        <p v-else class="sl-empty sl-empty--detail">
          选择一条请求查看详情。StreamLens 只捕获安装后发起的流式请求。
        </p>
      </div>
    </div>

    <div v-if="settingsOpen" class="sl-backdrop" @click="settingsOpen = false" />
    <SettingsPanel
      v-if="settingsOpen"
      :settings="settings"
      @close="settingsOpen = false"
      @save="handleSettingsSave"
    />
  </section>
</template>
