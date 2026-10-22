<script setup lang="ts">
import type { StreamEvent } from '@streamlens/protocol'

defineProps<{
  events: StreamEvent[]
}>()

defineEmits<{
  select: [event: StreamEvent]
}>()
</script>

<template>
  <section class="errors">
    <h3>解析错误 ({{ events.length }})</h3>
    <p v-if="!events.length" class="empty">无 JSON / 协议解析错误</p>
    <button
      v-for="e in events"
      :key="e.id"
      type="button"
      class="row"
      @click="$emit('select', e)"
    >
      <span>#{{ e.index }}</span>
      <span class="msg">{{ e.parseError }}</span>
      <span class="preview">{{ e.data.slice(0, 60) }}…</span>
    </button>
  </section>
</template>

<style scoped>
.errors {
  padding: 10px 12px;
  flex: 1;
  overflow: auto;
}

h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.row {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 6px;
  width: 100%;
  text-align: left;
  padding: 6px;
  border: none;
  border-bottom: 1px solid var(--sl-border);
  background: transparent;
}

.msg {
  color: var(--sl-danger);
  grid-column: 2;
}

.preview {
  grid-column: 2;
  font-size: 12px;
  color: var(--sl-muted);
}

.empty {
  color: var(--sl-muted);
}
</style>
