<!--
  Component: MarkdownRender
  说明: 将传入的 markdown/HTML 字符串安全渲染为富文本（内部使用 `v-html`）。
  注意: 确保输入已预处理或来自可信源以避免 XSS 风险。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const props = defineProps<{ content: string }>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code, lang) {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    const highlighted = hljs.highlight(code, { language }).value
    // title part shows language on the left (if present) and a copy button on the right
    const langLabel =
      language && language !== 'plaintext' ? `<span class="code-lang">${language}</span>` : ''
    return `<div class="code-block"><div class="code-header">${langLabel}<button class="copy-btn" type="button">复制</button></div><div class="code-scroll"><code class="hljs language-${language}">${highlighted}</code></div></div>`
  },
})

const html = computed(() => md.render(props.content || ''))
const containerRef = ref<HTMLElement>()

function bindCopyHandlers() {
  const container = containerRef.value
  if (!container) return
  container.querySelectorAll<HTMLButtonElement>('button.copy-btn').forEach(button => {
    button.onclick = async event => {
      event.stopPropagation()
      // find the nearest code element inside the same code-block
      const block = button.closest('.code-block') as HTMLElement | null
      const codeEl = block?.querySelector('code') as HTMLElement | null
      const code = codeEl?.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        button.textContent = '已复制'
        setTimeout(() => {
          button.textContent = '复制'
        }, 1200)
      } catch (error) {
        console.warn('Copy failed', error)
        button.textContent = '失败'
        setTimeout(() => {
          button.textContent = '复制'
        }, 1200)
      }
    }
  })
}

watch(
  () => html.value,
  () => nextTick(bindCopyHandlers)
)

onMounted(() => nextTick(bindCopyHandlers))
</script>

<template>
  <div ref="containerRef" class="markdown" v-html="html"></div>
</template>

<style scoped>
.markdown :deep(p) {
  margin: 0.4rem 0;
  line-height: 1.6;
  color: var(--text-primary);
}

.markdown :deep(code) {
  background: var(--surface-alt);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.92em;
  color: var(--text-primary);
}

.markdown :deep(.code-block) {
  position: relative;
  background: var(--surface-alt);
  color: var(--text-primary);
  border-radius: 0.9rem;
  box-sizing: border-box;
  max-width: 100%;
  font-size: 0.9rem;
  border: 1px solid var(--border);
  overflow: hidden;
}

.markdown :deep(.code-block) .code-scroll {
  padding: 1rem;
  overflow-x: auto;
}

.markdown :deep(.code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.02);
  border-top-left-radius: 0.9rem;
  border-top-right-radius: 0.9rem;
}

.markdown :deep(.code-lang) {
  font-size: 0.85rem;
  color: var(--text-secondary);
  padding-left: 0.25rem;
}

.markdown :deep(.copy-btn) {
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  padding: 0.18rem 0.5rem;
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.08s ease;
  flex-shrink: 0;
}

.markdown :deep(.copy-btn:hover) {
  background: var(--border);
  transform: translateY(-1px);
}

.markdown :deep(code.hljs) {
  display: block;
  background: transparent;
}

/* 覆盖 markdown/highlight.js 插件默认的 language-* 类样式，使用主题变量统一风格 */
.markdown :deep([class*='language-']) {
  background: transparent !important;
  color: var(--text-primary) !important;
}

.markdown :deep(pre[class*='language-']) {
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

.markdown :deep(code[class*='language-']) {
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

/* 保持代码块在窄屏时使用横向滚动，避免换行破坏代码格式 */
@media (max-width: 420px) {
  .markdown :deep(pre.code-block) {
    /* ensure scrollbar is visible on very narrow screens */
    overflow-x: auto;
  }
  .markdown :deep(.copy-btn) {
    right: 0.5rem;
    top: 0.5rem;
    padding: 0.18rem 0.5rem;
  }
}

.markdown :deep(.hljs-keyword),
.markdown :deep(.hljs-selector-tag),
.markdown :deep(.hljs-literal) {
  color: #93c5fd;
}

.markdown :deep(.hljs-string),
.markdown :deep(.hljs-title),
.markdown :deep(.hljs-name) {
  color: #fbbf24;
}

.markdown :deep(.hljs-comment) {
  color: #94a3b8;
}

.markdown :deep(a) {
  color: var(--primary);
}

.markdown :deep(ul),
.markdown :deep(ol) {
  padding-left: 1.25rem;
  color: var(--text-primary);
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4),
.markdown :deep(h5),
.markdown :deep(h6) {
  color: var(--text-primary);
  margin: 0.75rem 0 0.5rem;
}

.markdown :deep(blockquote) {
  border-left: 3px solid var(--border-strong);
  padding-left: 1rem;
  margin: 0.5rem 0;
  color: var(--text-secondary);
}

.markdown :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0;
}

.markdown :deep(th),
.markdown :deep(td) {
  border: 1px solid var(--border);
  padding: 0.5rem;
  color: var(--text-primary);
}

.markdown :deep(th) {
  background: var(--surface-alt);
  font-weight: 600;
}
</style>
