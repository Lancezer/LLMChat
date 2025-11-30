/*
  Store: theme
  说明: 管理主题模式（`light` / `dark` / `auto`），将选择持久化到 localStorage 并应用到 DOM。
  使用: 通过 `useThemeStore().setTheme(...)` 控制；`auto` 模式会监听系统偏好。
*/
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'llmchat-theme-mode'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('auto')
  const effectiveTheme = ref<'light' | 'dark'>('light')

  // 从 localStorage 加载主题设置
  function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      mode.value = saved
    }
    updateEffectiveTheme()
  }

  // 更新实际应用的主题
  function updateEffectiveTheme() {
    if (mode.value === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      effectiveTheme.value = prefersDark ? 'dark' : 'light'
    } else {
      effectiveTheme.value = mode.value
    }
    applyTheme()
  }

  // 应用主题到 DOM
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', effectiveTheme.value)
    document.documentElement.style.colorScheme = effectiveTheme.value
  }

  // 设置主题模式
  function setTheme(newMode: ThemeMode) {
    mode.value = newMode
    localStorage.setItem(STORAGE_KEY, newMode)
    updateEffectiveTheme()
  }

  // 监听系统主题变化（仅在 auto 模式下）
  function setupMediaQueryListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (mode.value === 'auto') {
        updateEffectiveTheme()
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }

  // 初始化
  loadTheme()
  void setupMediaQueryListener()

  // 监听 mode 变化
  watch(mode, updateEffectiveTheme)

  return {
    mode,
    effectiveTheme,
    setTheme,
  }
})
