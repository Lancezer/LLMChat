<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChatSidebar from '@/components/chat/ChatSidebar.vue'
import ChatThread from '@/components/chat/ChatThread.vue'
import InputComposer from '@/components/chat/InputComposer.vue'
import { useChatSessionsStore } from '@/stores/chatSessions'
import MenuIcon from '@/assets/icons/menu.svg?raw'
import SidebarLeftIcon from '@/assets/icons/sidebar-left.svg?raw'

const router = useRouter()
const route = useRoute()
const chatSessions = useChatSessionsStore()

const isNarrow = ref(false)
const showTemporarySidebar = ref(false)
const manuallyCollapsed = ref(false)

const showSidebar = computed(() => {
  if (isNarrow.value) {
    return showTemporarySidebar.value
  }
  return !manuallyCollapsed.value
})

function updateMedia() {
  isNarrow.value = window.matchMedia('(max-width: 960px)').matches
  if (!isNarrow.value) {
    showTemporarySidebar.value = false
  }
}

function synchronizeSessionWithRoute() {
  const sessionId = route.params.sessionId as string | undefined
  if (sessionId && chatSessions.sessions.some(session => session.id === sessionId)) {
    chatSessions.setActiveSession(sessionId)
    return
  }
  if (chatSessions.activeSessionId) {
    router.replace({ name: 'chat', params: { sessionId: chatSessions.activeSessionId } })
    return
  }
  if (chatSessions.sessions[0]) {
    router.replace({ name: 'chat', params: { sessionId: chatSessions.sessions[0].id } })
  }
}

watch(
  () => route.params.sessionId,
  () => synchronizeSessionWithRoute(),
  { immediate: true }
)

watch(
  () => chatSessions.activeSessionId,
  sessionId => {
    if (!sessionId) return
    const current = route.params.sessionId as string | undefined
    if (current === sessionId) return
    router.replace({ name: 'chat', params: { sessionId } })
  }
)

function closeSidebar() {
  showTemporarySidebar.value = false
}

function toggleSidebar() {
  if (isNarrow.value) {
    showTemporarySidebar.value = !showTemporarySidebar.value
  } else {
    manuallyCollapsed.value = !manuallyCollapsed.value
  }
}

onMounted(() => {
  updateMedia()
  window.addEventListener('resize', updateMedia)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateMedia)
})
</script>

<template>
  <div class="chat-page" :class="{ 'sidebar-collapsed': !showSidebar && !isNarrow }">
    <aside
      class="sidebar"
      :class="{
        floating: isNarrow,
        collapsed: !showSidebar && !isNarrow,
        open: isNarrow && showSidebar,
        hidden: isNarrow && !showSidebar,
      }"
    >
      <div class="sidebar-inner">
        <ChatSidebar @navigate="closeSidebar" @close="closeSidebar" :isNarrow="isNarrow" />
      </div>
    </aside>
    <main class="conversation">
      <div class="conversation-header">
        <button
          type="button"
          class="toggle"
          @click="toggleSidebar"
          :title="showSidebar ? '收起边栏' : '展开边栏'"
        >
          <span v-html="showSidebar ? SidebarLeftIcon : MenuIcon"></span>
        </button>
        <h1>{{ chatSessions.activeSession?.title || '新的对话' }}</h1>
        <span class="badge">{{ chatSessions.sessions.length }} 个会话</span>
      </div>
      <section class="thread">
        <ChatThread />
      </section>
      <section class="composer">
        <InputComposer />
        <p class="disclaimer">内容由 AI 生成，仅供参考</p>
      </section>
    </main>
    <div v-if="showSidebar && isNarrow" class="overlay" @click="closeSidebar"></div>
  </div>
</template>

<style scoped>
.chat-page {
  display: grid;
  grid-template-columns: auto 1fr;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.sidebar {
  border-right: 1px solid var(--border);
  background: var(--surface);
  height: 100vh;
  overflow: hidden;
  transition:
    transform 0.3s ease,
    opacity 0.3s ease,
    width 0.3s ease;
  width: 320px;
}

.sidebar.collapsed {
  width: 0;
  transform: translateX(-320px);
  opacity: 0;
  pointer-events: none;
  border-right: none;
}

.sidebar.hidden {
  /* keep this class for state clarity; do NOT use display:none so animations can run */
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}

.sidebar.floating {
  position: fixed;
  inset: 0;
  z-index: 20;
  width: min(320px, 90vw);
  box-shadow: var(--shadow-soft);
  /* default hidden state for floating sidebar */
  transform: translateX(-100%);
  opacity: 0;
  transition:
    transform 0.28s ease,
    opacity 0.2s ease;
  will-change: transform, opacity;
  pointer-events: none;
}

.sidebar.floating.open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.close {
  border: none;
  background: var(--surface);
  padding: 1rem;
}

/* 窄屏浮动侧栏的关闭图标定位 */
.sidebar.floating .close {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  padding: 0.45rem;
  border-radius: 0.5rem;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar.floating .close .icon {
  display: flex;
  width: 1.1rem;
  height: 1.1rem;
}

.sidebar.floating .close .icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.conversation {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--surface-alt);
  overflow: hidden;
}

.conversation-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.conversation-header h1 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
  color: var(--text-primary);
}

.badge {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.toggle {
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border-radius: 0.5rem;
  color: var(--text-primary);
  transition: background-color 0.2s ease;
}

.toggle:hover {
  background-color: var(--surface-alt);
}

.toggle span {
  display: flex;
  width: 1.4rem;
  height: 1.4rem;
}

.toggle :deep(svg) {
  width: 100%;
  height: 100%;
}

.thread {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.composer {
  padding: 1rem 2rem 0.5rem;
  border-top: 1px solid var(--border);
  background: var(--surface-alt);
  flex-shrink: 0;
  max-height: 400px;
  overflow-y: auto;
}

.disclaimer {
  margin: 0.4rem 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: center;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: 10;
}

@media (max-width: 960px) {
  .chat-page,
  .chat-page.sidebar-collapsed {
    grid-template-columns: 1fr;
  }

  .conversation-header {
    padding: 1rem;
  }

  .composer {
    padding: 0.75rem 1rem 1rem;
  }

  .sidebar.floating {
    transition:
      transform 0.28s ease,
      opacity 0.2s ease;
    will-change: transform, opacity;
    left: 0;
    top: 0;
    height: 100vh;
    transform: translateX(0);
    opacity: 1;
  }
  .sidebar.floating.hidden {
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
  }
}
</style>
