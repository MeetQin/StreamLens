<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: unknown
}>()

const text = computed(() => JSON.stringify(props.value, null, 2))
</script>

<template>
  <pre class="mono json">{{ text }}</pre>
</template>

<style scoped>
.json {
  margin: 0;
  padding: 8px;
  background: var(--sl-surface);
  border: 1px solid var(--sl-border);
  border-radius: 4px;
  overflow: auto;
  max-height: 280px;
}
</style>
