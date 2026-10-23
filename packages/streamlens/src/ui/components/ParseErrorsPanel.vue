<script setup lang="ts">
import type { StreamEvent } from '@streamlens/protocol'
import { previewText } from '../format'

defineProps<{
  events: StreamEvent[]
}>()

defineEmits<{
  select: [event: StreamEvent]
}>()
</script>

<template>
  <section class="sl-errors">
    <div class="sl-section-head">
      <h3>解析错误</h3>
      <span class="sl-muted">{{ events.length }} 条</span>
    </div>
    <p v-if="!events.length" class="sl-empty">无 JSON / 协议解析错误</p>
    <button
      v-for="event in events"
      :key="event.id"
      type="button"
      class="sl-error-row"
      @click="$emit('select', event)"
    >
      <span class="sl-ev-index">#{{ event.index }}</span>
      <span class="sl-error-text">{{ event.parseError }}</span>
      <span class="sl-muted">{{ previewText(event.data, 60) }}</span>
    </button>
  </section>
</template>
