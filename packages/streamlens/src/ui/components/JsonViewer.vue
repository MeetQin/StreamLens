<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: unknown
}>()

const text = computed(() => JSON.stringify(props.value, null, 2))
</script>

<template>
  <pre class="sl-mono sl-json">{{ text }}</pre>
</template>
