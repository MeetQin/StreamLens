<script setup lang="ts">
import { reactive } from 'vue'

export interface InPageSettings {
  enableAiAdapter: boolean
  redactOnExport: boolean
}

const props = defineProps<{
  settings: InPageSettings
}>()

const emit = defineEmits<{
  close: []
  save: [settings: InPageSettings]
}>()

const form = reactive<InPageSettings>({ ...props.settings })

function save(): void {
  emit('save', {
    enableAiAdapter: form.enableAiAdapter,
    redactOnExport: form.redactOnExport,
  })
}
</script>

<template>
  <div class="sl-settings" role="dialog" aria-label="StreamLens 设置">
    <h3>设置</h3>
    <label class="sl-check">
      <input v-model="form.enableAiAdapter" type="checkbox" />
      OpenAI / AI 流适配
    </label>
    <label class="sl-check">
      <input v-model="form.redactOnExport" type="checkbox" />
      导出时脱敏 URL 与事件内容
    </label>
    <p class="sl-hint">设置修改后对后续采集与导出生效。</p>
    <div class="sl-settings-actions">
      <button type="button" class="sl-btn" @click="$emit('close')">取消</button>
      <button type="button" class="sl-btn sl-btn--primary" @click="save">保存</button>
    </div>
  </div>
</template>
