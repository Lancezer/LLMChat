<!--
  Component: ChatThread
  说明: 渲染消息线程区域，管理滚动、分块渲染、向上自动加载以及“回到底部”交互。
  使用: 暴露 `containerRef` 用于外部或测试定位；内部通过 `messages` 计算渲染项并合并附属卡片。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ChatMessage, AssistantCard } from '@/types/chat'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageIcon from '@/assets/icons/message.svg?raw'
import CheckIcon from '@/assets/icons/check.svg?raw'
import ArrowDownIcon from '@/assets/icons/arrow-down.svg?raw'

const chatStore = useChatStore()
const { messages } = storeToRefs(chatStore)
const containerRef = ref<HTMLElement>()
const autoStick = ref(true)
const isScrolling = ref(false)
const showScrollButton = ref(false)
let scrollTimeout: number | undefined
// 顶部停留加载控制
const topThreshold = 50 // 判定为到达顶部的距离阈值（px）
const topHoldDelay = 600 // 在顶部停留超过该毫秒数触发加载
let topHoldTimeout: number | undefined
const initialArrived = ref(false) // 首次进入时不触发自动加载
const isAutoLoading = ref(false) // 防止重复自动加载
const autoLoadCooldown = 500 // 自动加载后短暂冷却（ms）
let lastAutoLoadAt = 0

// 分块渲染：只渲染最近的若干条消息以减少 DOM 压力
const visibleCount = ref(100) // 初始渲染最近 100 条消息
// 每次点击“加载更早的内容”时，增加的渲染消息数（可根据需要调整）
const loadStep = ref(50)
const visibleMessages = computed<ChatMessage[]>(() => {
  if (messages.value.length <= visibleCount.value) return messages.value as ChatMessage[]
  return messages.value.slice(-visibleCount.value) as ChatMessage[]
})

const hasMore = computed(() => messages.value.length > visibleCount.value)

// 将紧接着的“文本回复 + 卡片”合并为一个渲染项：{ message, attachedCard? }
const mergedMessages = computed(() => {
  const list = visibleMessages.value
  const out: Array<{ message: ChatMessage; attachedCards?: AssistantCard[] }> = []
  for (let i = 0; i < list.length; i++) {
    const msg = list[i]
    // 如果当前是 assistant 的文本，收集紧随其后的所有 assistant card 并合并
    if (msg && msg.role === 'assistant' && msg.type === 'text') {
      const cards: AssistantCard[] = []
      let j = i + 1
      while (j < list.length) {
        const nxt = list[j]
        if (nxt && nxt.role === 'assistant' && nxt.type === 'card' && nxt.card) {
          cards.push(nxt.card)
          j++
        } else {
          break
        }
      }
      if (cards.length > 0) {
        out.push({ message: msg, attachedCards: cards })
        i = j - 1 // skip merged cards
        continue
      }
    }
    if (msg) {
      out.push({ message: msg })
    }
  }
  return out
})

async function loadOlder() {
  const el = containerRef.value
  if (!el) {
    visibleCount.value = Math.min(messages.value.length, visibleCount.value + loadStep.value)
    return
  }

  // 记录当前滚动信息以便加载更多后保持视图不跳动
  const prevScrollHeight = el.scrollHeight
  const prevScrollTop = el.scrollTop

  visibleCount.value = Math.min(messages.value.length, visibleCount.value + loadStep.value)

  // 等待 DOM 更新并微调滚动位置，保证加载更多时视图保持在原消息上
  await nextTick()
  // 为了确保没有平滑滚动（CSS 可能设置了 `scroll-behavior: smooth`），
  // 临时覆盖内联样式为 'auto'，在定位后恢复原始值。
  const prevBehavior = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'

  requestAnimationFrame(() => {
    // 新高度 - 旧高度 + 旧滚动位置 = 应当设置的新 scrollTop
    const newScrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop
    // 立即定位（无动画）
    el.scrollTo({ top: newScrollTop, behavior: 'auto' })

    // 恢复之前的滚动行为（放到下一个事件循环，以确保定位已完成）
    setTimeout(() => {
      el.style.scrollBehavior = prevBehavior || ''
    }, 0)
  })
}

const isEmpty = computed(() => messages.value.length === 0)

function handleScroll() {
  const el = containerRef.value
  if (!el) return

  isScrolling.value = true

  // 清除之前的定时器
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }

  // 设置新的定时器，标记滚动结束
  scrollTimeout = window.setTimeout(() => {
    isScrolling.value = false
  }, 150)

  const threshold = 100
  const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
  autoStick.value = isAtBottom

  // 显示按钮：当不在底部且内容超过视口高度时
  showScrollButton.value = !isAtBottom && el.scrollHeight > el.clientHeight + 200

  // 当滚动到顶部并停留一段时间，则自动加载更多（首次进入不触发）
  const isAtTop = el.scrollTop <= topThreshold

  if (isAtTop && initialArrived.value && hasMore.value && !isAutoLoading.value) {
    if (topHoldTimeout) clearTimeout(topHoldTimeout)
    topHoldTimeout = window.setTimeout(async () => {
      // 防抖与冷却
      const now = Date.now()
      if (now - lastAutoLoadAt < autoLoadCooldown) return
      isAutoLoading.value = true
      try {
        await loadOlder()
      } catch {
        // ignore
      } finally {
        lastAutoLoadAt = Date.now()
        // 给一次小的缓冲，防止连续触发
        setTimeout(() => {
          isAutoLoading.value = false
        }, 200)
      }
    }, topHoldDelay)
  } else {
    if (topHoldTimeout) {
      clearTimeout(topHoldTimeout)
      topHoldTimeout = undefined
    }
  }
}

function scrollToBottom(smooth = true) {
  const el = containerRef.value
  if (!el) return

  requestAnimationFrame(() => {
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  })
}

function handleScrollToBottom() {
  autoStick.value = true
  showScrollButton.value = false
  scrollToBottom(true)
}

function isLatestAssistantMessage(message: ChatMessage): boolean {
  if (message.role !== 'assistant') return false
  const idx = messages.value.findIndex((m: ChatMessage) => m.id === message.id)
  if (idx === -1) return false
  // 如果后续存在 assistant 类型消息，但这些消息都是 card（与当前文本关联），
  // 则仍然把当前文本视为最新的可重新生成消息。
  for (let i = idx + 1; i < messages.value.length; i++) {
    const m = messages.value[i]
    if (m?.role === 'assistant') {
      // 发现后续的 assistant 文本消息 -> 不是最新
      if (m.type !== 'card') return false
      // 如果是 card，则认为它是附属于之前的消息，继续检查下一个
    }
  }
  return true
}

// 已移除虚拟加载（loadOlder）逻辑，渲染全部消息

// 监听消息变化，新消息时自动滚动到底部
watch(
  () => messages.value,
  async (newMessages, oldMessages) => {
    await nextTick()

    // 如果消息数量没变化（只是内容更新），不需要额外处理
    if (newMessages.length === oldMessages?.length) {
      // 仅在当前处于底部时，才自动下翻（例如内容变更导致高度变化）
      if (autoStick.value) {
        scrollToBottom()
      }
      return
    }

    // 新增消息时：仅在之前处于底部时，自动下翻；否则保持当前位置不变
    if (autoStick.value) {
      scrollToBottom()
    }
  },
  { deep: true }
)

onMounted(async () => {
  // 等待 DOM 更新后滚到底部
  await nextTick()
  requestAnimationFrame(() => {
    scrollToBottom(false)
  })
  // 标记首次进入已经完成滚动，避免在初始滚动时触发顶部自动加载
  setTimeout(() => {
    initialArrived.value = true
  }, 300)
})

onUnmounted(() => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  if (topHoldTimeout) {
    clearTimeout(topHoldTimeout)
  }
})
</script>

<template>
  <div class="thread-wrapper">
    <div
      ref="containerRef"
      class="thread-shell"
      :class="{ 'no-scroll': isEmpty }"
      @scroll="handleScroll"
    >
      <div class="load-more" v-if="hasMore">
        <button type="button" class="link" @click="loadOlder">
          加载更早的内容 (还有 {{ messages.length - visibleCount }} 条)
        </button>
      </div>
      <div v-if="isEmpty" class="empty">
        <div class="empty-icon" v-html="MessageIcon"></div>
        <h3>欢迎来到 LLMChat</h3>
        <p>这是一个基于 Vue 3 + TypeScript + Pinia 的 AI 对话应用</p>
        <div class="features">
          <div class="feature">
            <span class="check-icon" v-html="CheckIcon"></span>
            <span>支持 Markdown 渲染</span>
          </div>
          <div class="feature">
            <span class="check-icon" v-html="CheckIcon"></span>
            <span>代码高亮与一键复制</span>
          </div>
          <div class="feature">
            <span class="check-icon" v-html="CheckIcon"></span>
            <span>流式响应打字机效果</span>
          </div>
          <div class="feature">
            <span class="check-icon" v-html="CheckIcon"></span>
            <span>本地持久化存储</span>
          </div>
          <div class="feature">
            <span class="check-icon" v-html="CheckIcon"></span>
            <span>多会话管理</span>
          </div>
        </div>
        <p class="hint">在下方输入框开始对话，或点击左侧创建新会话</p>
      </div>
      <div class="stack" v-else>
        <MessageBubble
          v-for="item in mergedMessages"
          :key="item.message.id"
          :message="item.message"
          :attachedCards="item.attachedCards"
          :isLatestAssistant="isLatestAssistantMessage(item.message)"
        />
      </div>
    </div>
    <div v-if="showScrollButton && !isEmpty" class="scroll-indicator">
      <button type="button" class="scroll-to-bottom" @click="handleScrollToBottom" title="回到底部">
        <span class="icon" v-html="ArrowDownIcon"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.thread-wrapper {
  height: 100%;
  position: relative;
  overflow: hidden;
}

.thread-shell {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2rem 1.5rem 1rem;
  position: relative;
  scroll-behavior: smooth;
}

.thread-shell.no-scroll {
  overflow-y: hidden;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 880px;
  margin: 0 auto;
  padding-bottom: 2rem;
  position: relative;
}

.load-more {
  text-align: center;
  margin-bottom: 1.5rem;
  padding: 1rem 0;
}

.link {
  border: none;
  background: none;
  color: var(--primary);
  cursor: pointer;
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.2s ease;
}

.link:hover {
  background-color: rgba(37, 99, 235, 0.1);
}

.empty {
  text-align: center;
  max-width: 600px;
  margin: 6rem auto 0;
  color: var(--text-secondary);
  padding: 2rem;
}

.empty-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
  opacity: 0.8;
}

.empty-icon :deep(svg) {
  width: 4rem;
  height: 4rem;
  color: var(--primary);
}

.empty h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1.75rem;
}

.empty p {
  margin: 0.75rem 0;
  line-height: 1.6;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin: 2rem 0;
  text-align: left;
}

.feature {
  background: var(--surface);
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  font-size: 0.9rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.check-icon {
  display: flex;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.check-icon :deep(svg) {
  width: 100%;
  height: 100%;
  color: var(--success);
}

.hint {
  margin-top: 2rem;
  color: var(--text-secondary);
}

.scroll-indicator {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  z-index: 10;
  pointer-events: none;
}

.scroll-to-bottom {
  pointer-events: auto;
  padding: 0.75rem;
  border: none;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scroll-to-bottom .icon {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
}

.scroll-to-bottom .icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.scroll-to-bottom:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

@media (max-width: 640px) {
  .thread-shell {
    padding: 1.25rem 1rem 0.5rem;
  }

  .stack {
    gap: 1rem;
    padding-bottom: 1rem;
  }

  .empty {
    margin-top: 3rem;
    padding: 1rem;
  }

  .empty-icon {
    font-size: 3rem;
  }

  .empty h3 {
    font-size: 1.4rem;
  }

  .features {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .scroll-to-bottom {
    padding: 0.5rem;
    font-size: 0.9rem;
  }
}
</style>
