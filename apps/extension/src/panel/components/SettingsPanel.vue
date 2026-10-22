<script setup lang="ts">
import type { StreamLensSettings } from '@streamlens/protocol'
import { DEFAULT_SETTINGS } from '@streamlens/protocol'
import { reactive, watch } from 'vue'

const props = defineProps<{
  open: boolean
  settings: StreamLensSettings | null
}>()

const emit = defineEmits<{
  close: []
  save: [settings: StreamLensSettings]
}>()

const form = reactive<StreamLensSettings>({
  ...DEFAULT_SETTINGS,
  limits: { ...DEFAULT_SETTINGS.limits },
})

watch(
  () => props.settings,
  (s) => {
    if (!s) return
    form.enableAiAdapter = s.enableAiAdapter
    form.redactOnExport = s.redactOnExport
    form.enableCdpMetadata = s.enableCdpMetadata
    form.enableCdpBodyStream = s.enableCdpBodyStream
    form.persistSession = s.persistSession
    form.limits = { ...s.limits }
  },
  { immediate: true },
)

function submit(): void {
  emit('save', {
    enableAiAdapter: form.enableAiAdapter,
    redactOnExport: form.redactOnExport,
    enableCdpMetadata: form.enableCdpMetadata,
    enableCdpBodyStream: form.enableCdpBodyStream,
    persistSession: form.persistSession,
    limits: { ...form.limits },
  })
  emit('close')
}
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="$emit('close')">
    <div class="panel" role="dialog" aria-label="StreamLens Settings">
      <header>
        <h3>设置</h3>
        <button type="button" @click="$emit('close')">×</button>
      </header>
      <label class="check">
        <input v-model="form.enableAiAdapter" type="checkbox" />
        启用 AI 流式适配器（OpenAI chat/completions、`[DONE]`）
      </label>
      <label class="check">
        <input v-model="form.redactOnExport" type="checkbox" />
        导出时脱敏（Token、URL 参数、密钥字段）
      </label>
      <label class="check">
        <input v-model="form.enableCdpMetadata" type="checkbox" />
        启用 CDP 元数据（需 debugger 权限，仅补充 URL/状态，无响应体）
      </label>
      <label class="check">
        <input v-model="form.enableCdpBodyStream" type="checkbox" />
        CDP 响应体流式读取（原型：streamResourceContent + IO.read；未注入时兜底）
      </label>
      <label class="check">
        <input v-model="form.persistSession" type="checkbox" />
        关闭 DevTools 后保留当前 Tab 的采集快照（chrome.storage.session）
      </label>
      <label>
        单条事件最大字符
        <input v-model.number="form.limits.maxEventDataChars" type="number" min="1024" step="1024" />
      </label>
      <label>
        单请求最大事件数
        <input v-model.number="form.limits.maxEventsPerRequest" type="number" min="100" step="100" />
      </label>
      <label>
        最大请求数
        <input v-model.number="form.limits.maxRequests" type="number" min="50" step="50" />
      </label>
      <footer>
        <button type="button" class="primary" @click="submit">保存</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.panel {
  width: min(420px, 92vw);
  background: var(--sl-surface);
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h3 {
  margin: 0;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.check {
  flex-direction: row;
  align-items: center;
}

footer {
  display: flex;
  justify-content: flex-end;
}
</style>
