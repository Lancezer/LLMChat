<!--
  Component: CardMessage
  说明: 渲染助手返回的“卡片”类型消息（包含标题、摘要与可选操作）。
  用途: 在消息流中作为附属卡片展示，通常与前一条文本消息关联。
-->
<script setup lang="ts">
import type { AssistantCard } from '@/types/chat'

const props = defineProps<{ card: AssistantCard }>()

function openLink() {
  window.open(props.card.actionUrl, '_blank', 'noopener')
}
</script>

<template>
  <div class="card">
    <p class="label">{{ card.cardType === 'contact' ? '好友推荐' : '精选资源' }}</p>
    <h4>{{ card.title }}</h4>
    <p class="desc">{{ card.description }}</p>
    <button type="button" class="cta" @click="openLink">{{ card.actionText }}</button>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid var(--border-strong);
  border-radius: 1rem;
  padding: 1rem;
  background: var(--surface-alt);
  box-shadow: var(--shadow-soft);
}

.label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

h4 {
  margin: 0.5rem 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.desc {
  margin: 0;
  color: var(--text-secondary);
}

.cta {
  margin-top: 0.8rem;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: none;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 600;
  cursor: pointer;
}
</style>
