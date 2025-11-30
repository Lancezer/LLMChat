<!--
  Component: ChatSidebar
  说明: 渲染侧边栏会话列表、用户信息与操作（新建、重命名、删除、重置）。
  使用: 与 `chatSessions`、`chatStore`、`authStore` 协同管理会话导航与状态变更。
-->
<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatSessionsStore } from '@/stores/chatSessions'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from './ThemeToggle.vue'
import ConfirmModal from './ConfirmModal.vue'
import CloseIcon from '@/assets/icons/close.svg?raw'
import RotateIcon from '@/assets/icons/rotate.svg?raw'
import EditIcon from '@/assets/icons/edit.svg?raw'

const props = defineProps<{ isNarrow?: boolean }>()

const router = useRouter()
const route = useRoute()
const chatSessions = useChatSessionsStore()
const chatStore = useChatStore()
const authStore = useAuthStore()
const emit = defineEmits<{ (e: 'navigate'): void; (e: 'close'): void }>()

function handleClose() {
  emit('close')
}

const showDeleteConfirm = ref(false)
const showResetConfirm = ref(false)
const sessionToDelete = ref<string | null>(null)
const editingSessionId = ref<string | null>(null)
const editingTitle = ref('')

function selectSession(sessionId: string) {
  chatSessions.setActiveSession(sessionId)
  router.push({ name: 'chat', params: { sessionId } })
  emit('navigate')
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', { hour12: false })
}

async function handleCreate() {
  const sessionId = chatStore.startNewSession()
  await router.push({ name: 'chat', params: { sessionId } })
  emit('navigate')
}

function handleDelete(sessionId: string, event: MouseEvent) {
  event.stopPropagation()
  sessionToDelete.value = sessionId
  showDeleteConfirm.value = true
}

function confirmDelete() {
  if (!sessionToDelete.value) return

  const sessionId = sessionToDelete.value
  chatStore.deleteSession(sessionId)
  const activeFromRoute = route.params.sessionId
  if (activeFromRoute === sessionId) {
    const nextSession = chatSessions.activeSessionId
    router.push({ name: 'chat', params: { sessionId: nextSession ?? undefined } })
  }
  emit('navigate')

  showDeleteConfirm.value = false
  sessionToDelete.value = null
}

function cancelDelete() {
  showDeleteConfirm.value = false
  sessionToDelete.value = null
}

function handleReset() {
  showResetConfirm.value = true
}

function confirmReset() {
  chatStore.resetAll()
  router.push({ name: 'chat' })
  emit('navigate')
  showResetConfirm.value = false
}

function cancelReset() {
  showResetConfirm.value = false
}

function startEdit(sessionId: string, currentTitle: string, event: MouseEvent) {
  event.stopPropagation()
  editingSessionId.value = sessionId
  editingTitle.value = currentTitle
  nextTick(() => {
    const input = document.querySelector('.title-input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function saveEdit(sessionId: string) {
  const trimmed = editingTitle.value.trim()
  if (trimmed && trimmed !== chatSessions.sessions.find(s => s.id === sessionId)?.title) {
    chatSessions.renameSession(sessionId, trimmed)
    chatStore.persist()
  }
  editingSessionId.value = null
  editingTitle.value = ''
}

function cancelEdit() {
  editingSessionId.value = null
  editingTitle.value = ''
}

function handleEditKeydown(event: KeyboardEvent, sessionId: string) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEdit(sessionId)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  }
}

function isActive(sessionId: string) {
  return chatSessions.activeSessionId === sessionId
}
</script>

<template>
  <div class="sidebar-shell">
    <header>
      <div class="header-top">
        <p class="product">LLM Chat</p>
        <div class="header-controls">
          <ThemeToggle />
          <button
            v-if="props.isNarrow"
            type="button"
            class="ghost-icon close-top"
            @click="handleClose"
            title="关闭边栏"
          >
            <span v-html="CloseIcon"></span>
          </button>
        </div>
      </div>
      <button type="button" class="primary" @click="handleCreate">+ 新建对话</button>
    </header>

    <div class="list" v-if="chatSessions.sessions.length">
      <button
        v-for="session in chatSessions.sessions"
        :key="session.id"
        type="button"
        class="session"
        :class="{ active: isActive(session.id) }"
        @click="selectSession(session.id)"
      >
        <div class="session-header">
          <div class="session-info">
            <input
              v-if="editingSessionId === session.id"
              v-model="editingTitle"
              type="text"
              class="title-input"
              @click.stop
              @keydown="handleEditKeydown($event, session.id)"
              @blur="saveEdit(session.id)"
            />
            <p v-else class="title">{{ session.title }}</p>
            <p class="time">{{ formatTime(session.updatedAt) }}</p>
          </div>
          <div class="session-actions">
            <button
              v-if="editingSessionId !== session.id"
              type="button"
              class="ghost-icon"
              title="编辑"
              @click="startEdit(session.id, session.title, $event)"
            >
              <span v-html="EditIcon"></span>
            </button>
            <button
              type="button"
              class="ghost-icon"
              title="删除"
              @click="handleDelete(session.id, $event)"
            >
              <span v-html="CloseIcon"></span>
            </button>
          </div>
        </div>
      </button>
    </div>
    <div class="empty" v-else>
      <p>还没有会话，点击上方按钮开始体验。</p>
    </div>

    <div class="footer">
      <div class="user">
        <div class="avatar" :style="{ background: authStore.avatarColor }">
          {{ authStore.initials }}
        </div>
        <div>
          <p class="name">{{ authStore.username }}</p>
          <p class="role">Demo 用户</p>
        </div>
      </div>
      <button type="button" class="ghost-icon" @click="handleReset" title="重置所有数据">
        <span v-html="RotateIcon"></span>
      </button>
    </div>

    <!-- 确认弹窗 -->
    <ConfirmModal
      :show="showDeleteConfirm"
      title="确认删除"
      message="确定要删除这个对话吗？此操作不可恢复。"
      confirm-text="删除"
      confirm-variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <ConfirmModal
      :show="showResetConfirm"
      title="确认重置"
      message="确定要重置所有数据吗？这将删除所有对话记录，此操作不可恢复。"
      confirm-text="重置"
      confirm-variant="danger"
      @confirm="confirmReset"
      @cancel="cancelReset"
    />
  </div>
</template>

<style scoped>
.sidebar-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1rem;
  flex-shrink: 0;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-top {
  width: 2.2rem;
  height: 2.2rem;
  padding: 0.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.product {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.primary {
  width: 100%;
  padding: 0.5rem 1rem;
  border-radius: 0.85rem;
  border: none;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 600;
  cursor: pointer;
}

.list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0 1rem 1rem;
  min-height: 0;
}

.session {
  display: flex;
  flex-direction: column;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 0.8rem;
  background: var(--surface);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.session:hover {
  border-color: var(--border-strong);
}

.session.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.session-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.title {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-input {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
  border: 1px solid var(--primary);
  border-radius: 0.4rem;
  padding: 0.2rem 0.4rem;
  background: var(--surface);
  width: 100%;
  outline: none;
}

.title-input:focus {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.time {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.session-actions {
  flex-shrink: 0;
  display: flex;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.session:hover .session-actions {
  opacity: 1;
}

.ghost {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.ghost-icon {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  width: 2rem;
  height: 2rem;
}

.ghost-icon:hover {
  background-color: var(--surface-alt);
}

.ghost-icon span {
  display: flex;
  width: 1.1rem;
  height: 1.1rem;
}

.ghost-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.empty {
  flex: 1;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  display: grid;
  place-items: center;
  padding: 1rem;
  margin: 0 1rem 1rem;
  color: var(--text-secondary);
  text-align: center;
  min-height: 0;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-top: 1px solid var(--border);
  padding: 1rem;
  flex-shrink: 0;
}

.user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  color: var(--primary-foreground);
  display: grid;
  place-items: center;
  font-weight: 600;
  flex-shrink: 0;
}

.name {
  margin: 0;
  font-weight: 600;
}

.role {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}
</style>
