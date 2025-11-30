<!--
  Component: MessageBubble
  说明: 渲染单条消息气泡（用户 / 助手 / 卡片），包含状态样式、头像与错误提示。
  Props: 接收 `message`、`attachedCards` 等，用于展示不同类型的消息内容。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessage, AssistantCard } from '@/types/chat'
import MarkdownRender from './MarkdownRender.vue'
import CardMessage from './CardMessage.vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import BotIcon from '@/assets/icons/bot.svg?raw'
import CopyIcon from '@/assets/icons/copy.svg?raw'
import FileDocIcon from '@/assets/icons/file.svg?raw'
import DownloadIcon from '@/assets/icons/download.svg?raw'
import CheckIcon from '@/assets/icons/check.svg?raw'
import RefreshIcon from '@/assets/icons/refresh.svg?raw'
import ClockIcon from '@/assets/icons/clock.svg?raw'
import XCircleIcon from '@/assets/icons/x-circle.svg?raw'
import { getFile } from '@/lib/fileStorage'
import { onMounted, onUnmounted, watch, ref as vueRef } from 'vue'

const props = defineProps<{
  message: ChatMessage
  isLatestAssistant?: boolean
  attachedCards?: AssistantCard[]
}>()

const chatStore = useChatStore()
const authStore = useAuthStore()
const copying = ref(false)
const regenerating = ref(false)
// local object URL used for rendering / download when attachment stored in IndexedDB
const localUrl = vueRef<string | null>(null)

onMounted(async () => {
  await ensureLocalUrl()
})

onUnmounted(() => {
  if (localUrl.value) {
    URL.revokeObjectURL(localUrl.value)
    localUrl.value = null
  }
})

watch(
  () => props.message.attachment?.storageKey,
  async () => {
    await ensureLocalUrl()
  }
)

async function ensureLocalUrl() {
  // revoke previous
  if (localUrl.value) {
    try {
      URL.revokeObjectURL(localUrl.value)
    } catch {
      // ignore
    }
    localUrl.value = null
  }
  const key = props.message.attachment?.storageKey
  if (key) {
    try {
      const blob = await getFile(key)
      if (blob) {
        localUrl.value = URL.createObjectURL(blob)
      }
    } catch {
      // silent
    }
  } else if (props.message.attachment?.url) {
    localUrl.value = props.message.attachment.url
  }
}

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isCard = computed(() => props.message.type === 'card' && props.message.card)
const isFile = computed(() => props.message.type === 'file')
const hasAttachedCard = computed(
  () => Array.isArray(props.attachedCards) && props.attachedCards.length > 0
)
const canRegenerate = computed(
  () => isAssistant.value && props.message.type === 'text' && props.isLatestAssistant
)
const timeLabel = computed(() => {
  const date = new Date(props.message.createdAt)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
})

const statusText = computed(() => {
  switch (props.message.status) {
    case 'pending':
      return '等待发送'
    case 'streaming':
      return 'AI 正在思考...'
    case 'error':
      return '发送失败，请稍后重试'
    default:
      return ''
  }
})

const statusIcon = computed(() => {
  if (props.message.status === 'error') {
    return XCircleIcon
  }
  return ''
})

const showStatus = computed(() => {
  return ['pending', 'streaming', 'error'].includes(props.message.status)
})

async function copyMessage() {
  if (copying.value || !props.message.content) return
  copying.value = true
  try {
    await navigator.clipboard.writeText(props.message.content)
  } catch (error) {
    console.warn('复制失败', error)
  } finally {
    setTimeout(() => {
      copying.value = false
    }, 1200)
  }
}

async function handleRegenerate() {
  if (props.message.status === 'streaming' || regenerating.value) return
  regenerating.value = true
  try {
    await chatStore.regenerateAssistantMessage(props.message.id)
  } catch (error) {
    console.error('重新生成失败', error)
  } finally {
    setTimeout(() => {
      regenerating.value = false
    }, 500)
  }
}
</script>

<template>
  <article class="bubble" :class="{ 'from-user': isUser, 'from-assistant': !isUser }">
    <div class="avatar" :class="{ user: isUser }">
      <span v-if="isUser">{{ authStore.initials }}</span>
      <span v-else class="bot-icon" v-html="BotIcon"></span>
    </div>
    <div class="content" :class="{ error: message.status === 'error' }">
      <header>
        <p class="role">{{ isUser ? authStore.username : 'LLM 助手' }}</p>
        <p class="time">{{ timeLabel }}</p>
      </header>
      <div class="body" :class="{ card: isCard || hasAttachedCard }">
        <CardMessage v-if="isCard && message.card" :card="message.card" />
        <template v-else>
          <template v-if="isFile">
            <div class="file-message">
              <template
                v-if="
                  message.attachment &&
                  message.attachment.mime &&
                  message.attachment.mime.startsWith('image/')
                "
              >
                <div class="image-card">
                  <div class="image-wrapper">
                    <img
                      class="file-image"
                      :src="localUrl || message.attachment?.url"
                      :alt="message.attachment.name"
                    />
                    <div class="image-overlay">
                      <a
                        class="download-btn overlay"
                        :href="localUrl || message.attachment?.url || '#'"
                        :download="message.attachment?.name"
                        :title="'下载 ' + (message.attachment?.name || '')"
                        v-if="localUrl || message.attachment?.url"
                        v-html="DownloadIcon"
                      ></a>
                    </div>
                  </div>
                  <div class="image-meta">
                    <div class="file-name">{{ message.attachment.name }}</div>
                    <div class="meta">
                      {{ message.attachment?.mime || '未知类型' }} ·
                      {{
                        (message.attachment?.size || 0) >= 1024
                          ? ((message.attachment?.size || 0) / 1024).toFixed(1) + ' KB'
                          : (message.attachment?.size || 0) + ' B'
                      }}
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="file-icon-row">
                  <div class="file-icon" v-html="FileDocIcon"></div>
                  <div class="file-info">
                    <div class="file-name">{{ message.content }}</div>
                    <div class="meta">
                      {{ message.attachment?.mime || '未知类型' }} ·
                      {{
                        (message.attachment?.size || 0) >= 1024
                          ? ((message.attachment?.size || 0) / 1024).toFixed(1) + ' KB'
                          : (message.attachment?.size || 0) + ' B'
                      }}
                    </div>
                  </div>
                  <div class="file-actions">
                    <a
                      class="download-btn"
                      :href="localUrl || message.attachment?.url || '#'"
                      :download="message.attachment?.name"
                      :title="'下载 ' + (message.attachment?.name || '')"
                      v-if="localUrl || message.attachment?.url"
                      v-html="DownloadIcon"
                    ></a>
                  </div>
                </div>
              </template>
            </div>
          </template>
          <template v-else>
            <MarkdownRender :content="message.content" />
            <template v-if="hasAttachedCard">
              <CardMessage v-for="(c, idx) in attachedCards" :key="c.actionUrl + idx" :card="c" />
            </template>
            <div v-if="message.status === 'streaming' && !message.content" class="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </template>
        </template>
      </div>
      <footer>
        <div class="status" v-if="showStatus">
          <span v-if="message.status === 'streaming'" class="dot"></span>
          <span v-if="statusIcon" class="status-icon" v-html="statusIcon"></span>
          {{ statusText }}
        </div>
        <div
          class="actions"
          v-if="isAssistant && message.type === 'text' && message.status !== 'streaming'"
        >
          <button
            type="button"
            class="action-btn"
            @click="copyMessage"
            :disabled="copying || !message.content"
            :title="copying ? '已复制到剪贴板' : '复制消息内容'"
          >
            <span class="icon" v-html="copying ? CheckIcon : CopyIcon"></span>
            <span>{{ copying ? '已复制' : '复制' }}</span>
          </button>
          <button
            v-if="canRegenerate"
            type="button"
            class="action-btn"
            @click="handleRegenerate"
            :disabled="regenerating"
            :title="message.status === 'error' ? '重新生成回答' : '重新生成'"
          >
            <span class="icon" v-html="regenerating ? ClockIcon : RefreshIcon"></span>
            <span>{{
              regenerating ? '生成中' : message.status === 'error' ? '重试' : '重新生成'
            }}</span>
          </button>
        </div>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.bubble {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.1);
  display: grid;
  place-items: center;
  font-weight: 600;
  color: var(--primary);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.avatar:hover {
  transform: scale(1.05);
}

.avatar.user {
  background: rgba(16, 185, 129, 0.15);
  color: var(--text-primary);
}

.bot-icon {
  display: flex;
  width: 1.8rem;
  height: 1.8rem;
}

.bot-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.content {
  background: var(--surface);
  border-radius: 1.2rem;
  padding: 1rem 1.2rem;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-width: 0;
}

.bubble.from-user .content {
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.2);
}

.content:hover {
  border-color: var(--border-strong);
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.12);
}

.bubble.from-user .content:hover {
  border-color: rgba(37, 99, 235, 0.35);
}

.content.error {
  border-color: var(--danger);
  background: rgba(239, 68, 68, 0.05);
}

header {
  display: flex;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 0.8rem;
}

.role {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.time {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.body {
  min-height: 1.5rem;
  min-width: 0;
}

/* 当消息正文后有附带卡片时，增加卡片与正文的间距 */
.body > .card {
  margin-top: 0.9rem;
}

.body.card {
  padding: 0;
}

.loading-dots {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.5rem 0;
}

.loading-dots span {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--primary);
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.status {
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.status-icon {
  display: flex;
  width: 1rem;
  height: 1rem;
  color: var(--danger);
}

.status-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--primary);
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(1.5);
    opacity: 0.4;
  }
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-btn {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  transition: background-color 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.action-btn:hover:not(:disabled) {
  background-color: rgba(37, 99, 235, 0.1);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn .icon {
  display: flex;
  width: 0.95rem;
  height: 0.95rem;
}

.action-btn .icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.ghost {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  transition: background-color 0.2s ease;
  white-space: nowrap;
}

.ghost:hover:not(:disabled) {
  background-color: rgba(37, 99, 235, 0.1);
}

.ghost:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .bubble {
    gap: 0.5rem;
  }

  .avatar {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 0.9rem;
  }

  .content {
    padding: 0.9rem;
  }

  header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .actions {
    width: 100%;
    justify-content: flex-start;
  }

  .ghost {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
  }
}

/* 在极窄屏（<=420px）隐藏头像以节省空间 */
@media (max-width: 420px) {
  .avatar {
    display: none;
  }
  .bubble {
    grid-template-columns: 1fr;
  }
}

/* File message styles */
.file-message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.file-image {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
}
.image-card {
  max-width: 420px;
  width: 100%;
  border-radius: 0.8rem;
  overflow: visible;
  box-shadow: none;
}
.image-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 0.8rem;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease;
}
.image-wrapper:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
}
.image-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.5rem;
  background: linear-gradient(180deg, transparent 55%, rgba(0, 0, 0, 0.22));
  opacity: 0;
  transition: opacity 0.12s ease;
}
.image-wrapper:hover .image-overlay {
  opacity: 1;
}
.download-btn.overlay {
  background: rgba(255, 255, 255, 0.06);
  color: white;
  border-radius: 0.5rem;
  padding: 0.4rem;
}
.image-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}
.image-meta .file-name {
  font-weight: 600;
  color: var(--primary);
}
.image-meta .meta {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.file-icon-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.file-icon {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  border-radius: 0.5rem;
  background: var(--surface-muted);
}
.file-info a {
  font-weight: 600;
  color: var(--primary);
}
.file-info .meta,
.file-info .size {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.file-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
}
.download-btn {
  display: inline-flex;
  width: 2.2rem;
  height: 2.2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--primary);
  border: none;
  padding: 0.25rem;
}
.download-btn :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}
.file-name {
  font-weight: 600;
  color: var(--primary);
}
.download-btn:hover {
  background-color: var(--surface-alt);
  transform: translateY(-2px);
  transition: all 0.12s ease;
}
.download-btn:active {
  transform: translateY(0);
}
</style>
