<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family:
    'Inter',
    'Segoe UI',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    Arial,
    sans-serif;
  background-color: var(--surface-alt);
  color: var(--text-primary);
}
</style>
