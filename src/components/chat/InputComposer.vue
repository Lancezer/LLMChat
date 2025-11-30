<!--
  Component: InputComposer
  说明: 底部输入区组件，处理文本输入、文件上传、发送、回车行为与快捷操作。
  使用: 向上通过事件触发 `send` 行为并与 `chat` store 协作。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import PaperclipIcon from '@/assets/icons/paperclip.svg?raw'
import TrashIcon from '@/assets/icons/trash.svg?raw'
import SendIcon from '@/assets/icons/send.svg?raw'

type PreviewFile = File & { previewUrl?: string }

const chatStore = useChatStore()
const draft = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const isSending = computed(() => chatStore.isSending)

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  // Respect min/max lines: min 2 lines, max 8 lines
  const style = window.getComputedStyle(el)
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5 || 24
  const minLines = 2
  const maxLines = 8
  const minHeight = Math.round(lineHeight * minLines)
  const maxHeight = Math.round(lineHeight * maxLines)
  const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
  el.style.height = `${newHeight}px`
}

async function handleSend() {
  if (isSending.value) return
  const hasText = !!draft.value.trim()
  const hasFiles = files.value.length > 0
  if (!hasText && !hasFiles) return
  const payload = draft.value
  draft.value = ''
  const sendingFiles = files.value.slice()
  // 清理 UI 中的文件列表先行（预览 URL 会在发送后撤销）
  files.value = []
  try {
    if (hasFiles) {
      await chatStore.sendFiles(sendingFiles)
    }
    if (hasText) {
      await chatStore.sendMessage(payload)
    }
    // 发送完成后，撤销为预览创建的 object URLs
    try {
      for (const f of sendingFiles) {
        const p = (f as PreviewFile).previewUrl
        if (p) {
          URL.revokeObjectURL(p)
        }
      }
    } catch {
      // ignore
    }
  } catch (error) {
    console.error('发送失败', error)
  }
  await nextTick()
  autoResize()
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  for (let i = 0; i < input.files.length; i++) {
    const f = input.files.item(i) as File
    // 若为图片，创建用于预览的 object URL
    try {
      if (f && f.type && f.type.startsWith('image/')) {
        ;(f as PreviewFile).previewUrl = URL.createObjectURL(f)
      }
    } catch {
      // ignore
    }
    files.value.push(f)
  }
  // 重置以便可以重复选择相同文件
  input.value = ''
}

function removeFile(index: number) {
  const f = files.value.splice(index, 1)[0]
  // 释放 object URL（如果已被创建并用于预览）
  // 注意：store 会为已发送文件创建 object URL 并负责释放（此处为预览时的释放）
  try {
    const previewUrl = (f as PreviewFile)?.previewUrl
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
  } catch {
    // ignore
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!isSending.value) {
      handleSend()
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain')
  if (text && text.length > 4000) {
    event.preventDefault()
    draft.value += text.slice(0, 4000)
  }
}

watch(draft, () => nextTick(autoResize))
onMounted(autoResize)
</script>

<template>
  <div class="composer-shell">
    <!-- toolbar moved into actions row for compact layout -->
    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      style="display: none"
      @change="handleFileChange"
    />

    <div v-if="files.length" class="file-previews">
      <div class="file-item" v-for="(f, idx) in files" :key="f.name + f.size + idx">
        <div class="file-meta">
          <strong>{{ f.name }}</strong>
          <span class="size">{{ (f.size / 1024).toFixed(1) }} KB</span>
        </div>
        <button class="ghost" type="button" title="移除文件" @click="removeFile(idx)">
          <span class="icon" v-html="TrashIcon"></span>
        </button>
      </div>
    </div>

    <textarea
      ref="textareaRef"
      v-model="draft"
      rows="2"
      placeholder="与 AI 对话，Enter 发送，Shift+Enter 换行"
      @keydown="handleKeydown"
      @paste="handlePaste"
    />
    <div class="actions">
      <div class="left-tools">
        <button class="ghost" type="button" title="上传文件" @click="triggerFileSelect">
          <span class="icon" v-html="PaperclipIcon"></span>
        </button>
        <button
          class="ghost"
          type="button"
          title="清空输入内容"
          @click="draft = ''"
          :disabled="!draft"
        >
          <span class="icon" v-html="TrashIcon"></span>
        </button>
      </div>
      <button
        type="button"
        class="primary"
        :disabled="isSending || (!draft.trim() && files.length === 0)"
        @click="handleSend"
        :title="isSending ? '发送中' : '发送消息'"
      >
        <span v-if="isSending" class="spinner" aria-hidden="true"></span>
        <span v-else class="icon" v-html="SendIcon"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer-shell {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 0.5rem 1rem 0.75rem;
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  /* 限制最大宽度并居中，与消息气泡内容对齐 */
  max-width: 880px;
  margin-left: auto;
  margin-right: auto;
}

.toolbar {
  display: flex;
  gap: 0.5rem;
}

.ghost {
  border: none;
  background: transparent;
  padding: 0.4rem;
  border-radius: 0.6rem;
  cursor: not-allowed;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ghost:not(:disabled) {
  cursor: pointer;
}

.ghost:not(:disabled):hover {
  background-color: var(--surface-alt);
}

.ghost .icon {
  display: flex;
  width: 1.1rem;
  height: 1.1rem;
}

.ghost .icon :deep(svg) {
  width: 100%;
  height: 100%;
}

textarea {
  width: 100%;
  border: none;
  resize: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
  line-height: 1.5;
  /* visual spacing and min/max height to keep input neat */
  margin: 0.5rem 0;
  min-height: 3rem; /* ~2 lines */
  max-height: 12rem; /* ~8 lines */
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.left-tools {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.primary {
  padding: 0.6rem;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  color: var(--primary-foreground);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.primary .icon {
  display: flex;
  width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
}

.primary .icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.primary:hover:not(:disabled) {
  transform: scale(1.05);
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(248, 250, 252, 0.4);
  border-top-color: var(--primary-foreground);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .composer-shell {
    padding: 0.5rem 0.75rem 0.75rem;
    max-width: none;
  }

  .actions {
    /* keep hint and button on the same row for narrow screens */
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  /* hint removed */

  .primary {
    /* fixed-size circular button stays to the right */
    flex: 0 0 auto;
    align-self: center;
  }
}
</style>
