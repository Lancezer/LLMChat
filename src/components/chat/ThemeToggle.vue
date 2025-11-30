<!--
  Component: ThemeToggle
  说明: 页面主题切换控件，循环切换 `light` / `dark` / `auto` 模式并持久化选择。
  使用: 依赖 `useThemeStore` 管理实际应用的主题与本地存储。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import SunIcon from '@/assets/icons/sun.svg?raw'
import MoonIcon from '@/assets/icons/moon.svg?raw'
import AutoIcon from '@/assets/icons/auto.svg?raw'

const themeStore = useThemeStore()

const themeIcon = computed(() => {
  switch (themeStore.mode) {
    case 'light':
      return SunIcon
    case 'dark':
      return MoonIcon
    case 'auto':
      return AutoIcon
    default:
      return SunIcon
  }
})

const themeLabel = computed(() => {
  switch (themeStore.mode) {
    case 'light':
      return '亮色'
    case 'dark':
      return '暗色'
    case 'auto':
      return '自动'
    default:
      return '主题'
  }
})

function cycleTheme() {
  const modes: ThemeMode[] = ['light', 'dark', 'auto']
  const currentIndex = modes.indexOf(themeStore.mode)
  const nextIndex = (currentIndex + 1) % modes.length
  const nextMode = modes[nextIndex]
  if (nextMode) {
    themeStore.setTheme(nextMode)
  }
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    @click="cycleTheme"
    :title="`当前：${themeLabel}，点击切换`"
  >
    <span class="icon" aria-hidden="true" v-html="themeIcon"></span>
    <span class="label">{{ themeLabel }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.35rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  width: 2rem;
  height: 2rem;
}

.theme-toggle:hover {
  background: var(--surface-alt);
}

.theme-toggle:active {
  transform: scale(0.95);
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
}

.icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.label {
  display: none;
}

@media (max-width: 640px) {
  .label {
    display: none;
  }

  .theme-toggle {
    padding: 0.35rem;
    width: 2rem;
    height: 2rem;
    justify-content: center;
  }

  .icon {
    width: 1.1rem;
    height: 1.1rem;
  }
}
</style>
