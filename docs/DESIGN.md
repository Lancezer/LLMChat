# LLMChat 设计文档

## 概述

- 项目路径：`LLMChat/`
- 目标：构建一个前端驱动的 LLM 对话客户端，禁止使用现成聊天 UI 组件库，核心对话流、状态管理、消息渲染与交互均由团队自行实现。
- 技术栈（项目中已采用）：Vue 3 + TypeScript + Pinia + Vite；富文本使用 `markdown-it` + `highlight.js`；文件二进制通过 IndexedDB 存储。

## 数据流设计

### 发送消息流程

```
用户输入
  ↓
InputComposer.vue (emit)
  ↓
chatStore.sendMessage()
  ↓
1. 创建用户消息 (status: sent)
2. 创建占位 AI 消息 (status: streaming)
3. 更新会话时间戳
  ↓
API 层 (openai.ts)
  ↓
Mock 服务 (mockService.ts)
  ↓
流式返回数据
  ↓
chatStore.streamIntoMessage()
  ↓
逐字更新消息内容
  ↓
完成 (status: sent) 或 错误 (status: error)
  ↓
持久化到 localStorage
```

### 会话切换流程

```
用户点击会话
  ↓
ChatSidebar.vue
  ↓
chatSessionsStore.setActiveSession()
  ↓
router.push (更新 URL)
  ↓
ChatThread.vue (响应式更新)
  ↓
加载对应会话的消息列表
  ↓
滚动到底部
```

## 核心功能实现

### 1. Markdown 渲染

使用 `markdown-it` 解析 Markdown 内容：

```typescript
const md = new MarkdownIt({
  html: false,        // 禁止 HTML 标签（安全考虑）
  linkify: true,      // 自动识别链接
  breaks: true,       // 换行符转换为 <br>
  highlight(code, lang) {
    // 使用 highlight.js 实现代码高亮
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    const highlighted = hljs.highlight(code, { language }).value
    return `<pre><code>${highlighted}</code></pre>`
  }
})
```

**特性**：

- 支持标题、列表、链接、粗体、斜体等常见格式
- 代码块语法高亮
- 一键复制代码功能
- XSS 防护

### 2. 流式响应（打字机效果）

使用异步生成器实现：

```typescript
async function* streamText(content: string, options: StreamOptions) {
  const chunkSize = options.chunkSize ?? 5  // 每次推送 5 个字符
  let cursor = 0
  
  while (cursor < content.length) {
    // 检查是否被中断
    if (options.signal?.aborted) {
      throw new DOMException('Stream aborted', 'AbortError')
    }
    
    const chunk = content.slice(cursor, cursor + chunkSize)
    cursor += chunkSize
    
    // 模拟网络延迟
    await delay(random(20, 60))
    
    yield chunk
  }
}
```

**特性**：

- 逐字符/逐词显示
- 可中断（AbortController）
- 模拟真实网络延迟
- 支持暂停和恢复

### 3. 虚拟滚动优化

简化版虚拟滚动实现：

```typescript
const visibleCount = ref(100)  // 初始显示 100 条

const visibleMessages = computed(() => {
  if (messages.value.length <= visibleCount.value) {
    return messages.value
  }
  // 只渲染最近的消息
  return messages.value.slice(-visibleCount.value)
})

function loadOlder() {
  // 滚动到顶部时加载更多
  visibleCount.value = Math.min(
    messages.value.length, 
    visibleCount.value + 100
  )
}
```

**优化效果**：

- 初始只渲染 100 条消息
- 减少 DOM 节点数量
- 提升渲染性能
- 支持按需加载历史消息

### 4. 本地持久化

使用 localStorage 实现数据持久化：

```typescript
interface PersistedChatState {
  sessions: ChatSession[]
  messages: Record<string, ChatMessage[]>
}

function persistChatState(state: PersistedChatState) {
  const payload = { version: 1, data: state }
  localStorage.setItem('llmchat:v1', JSON.stringify(payload))
}

function readInitialChatState(): PersistedChatState {
  try {
    const raw = localStorage.getItem('llmchat:v1')
    if (!raw) return defaultState
    const parsed = JSON.parse(raw)
    return parsed.data
  } catch {
    return defaultState
  }
}
```

**特性**：

- 版本化数据格式
- 错误容错处理
- 自动恢复机制
- 一键重置功能

### 5. 响应式布局

使用 CSS Grid 和 Media Queries：

```css
.chat-page {
  display: grid;
  grid-template-columns: 320px 1fr;  /* 桌面端双栏 */
}

@media (max-width: 960px) {
  .chat-page {
    grid-template-columns: 1fr;  /* 移动端单栏 */
  }
  
  .sidebar.floating {
    position: fixed;  /* 浮层显示侧边栏 */
    z-index: 20;
  }
}
```

**断点策略**：

- **960px**：切换单双栏布局
- **768px**：调整字体和间距
- **640px**：优化移动端交互

## 性能优化

### 1. 渲染优化

- **虚拟滚动**：长列表只渲染可见区域
- **计算属性缓存**：避免重复计算
- **v-memo 优化**：静态内容使用 memo
- **懒加载**：代码高亮库按需加载

### 2. 事件优化

- **防抖**：输入框 resize 事件
- **节流**：滚动事件处理
- **事件委托**：代码复制按钮绑定

### 3. 打包优化

- **代码分割**：路由级别的懒加载
- **Tree Shaking**：移除未使用的代码
- **资源压缩**：Vite 自动压缩 JS/CSS
- **依赖优化**：只引入必要的库

## 安全考虑

### 1. XSS 防护

- Markdown 渲染时禁用 HTML 标签
- v-html 只用于经过处理的内容
- 链接添加 `rel="noopener"` 属性

### 2. 数据验证

- TypeScript 类型检查
- 输入长度限制
- localStorage 数据校验

### 3. 错误处理

- Try-catch 包裹异步操作
- 友好的错误提示
- 降级方案

## 可访问性

### 1. 语义化 HTML

- 使用 `<article>` 表示消息
- 使用 `<button>` 而非 `<div>` 做按钮
- 合理使用标题层级

### 2. 键盘导航

- Focus 状态清晰可见
- Tab 键顺序合理
- Enter 键发送消息

### 3. 屏幕阅读器

- `aria-label` 标注重要元素
- `role` 属性标识组件功能
- 动态内容更新通知

## 浏览器兼容性

### 支持的浏览器

- Chrome/Edge >= 90
- Firefox >= 88
- Safari >= 14
- 移动端 iOS >= 14, Android >= 8

### 兼容性措施

- CSS 前缀（-webkit-, -moz-）
- Polyfill 关键 API
- 渐进增强策略
- 优雅降级方案

## 测试策略

### 1. 功能测试

- [ ] 发送消息
- [ ] 接收 AI 回复
- [ ] 流式响应
- [ ] 复制消息
- [ ] 重新生成
- [ ] 会话切换
- [ ] 会话删除
- [ ] 数据持久化

### 2. 响应式测试

- [ ] 桌面端（>1280px）
- [ ] 平板端（768px - 960px）
- [ ] 移动端（<640px）
- [ ] 横屏适配

### 3. 性能测试

- [ ] 首屏加载时间 < 2s
- [ ] 200+ 消息流畅滚动
- [ ] 内存占用合理
- [ ] 无明显卡顿

### 4. 兼容性测试

- [ ] Chrome 最新版
- [ ] Firefox 最新版
- [ ] Safari 最新版
- [ ] 移动端浏览器

## 未来展望

### 短期计划（1-2 周）

1. 添加深色模式
2. 支持导出对话
3. 优化移动端体验
4. 添加更多卡片类型

### 中期计划（1-2 月）

1. 接入真实 AI API
2. 支持图片上传
3. 语音输入功能
4. 多语言支持

### 长期计划（3-6 月）

1. 完整的虚拟滚动
2. 离线模式支持
3. 分享对话链接
4. 插件系统

## AI 辅助开发总结

### AI 的作用

1. **代码生成**：快速生成组件模板、类型定义
2. **问题解决**：技术难点咨询，API 使用参考
3. **代码优化**：性能优化建议，最佳实践推荐
4. **文档编写**：注释、README、类型文档

### 人工的作用

1. **架构设计**：整体架构、模块划分、数据流设计
2. **业务逻辑**：核心功能实现、状态管理、错误处理
3. **质量把控**：代码审查、性能优化、安全审计
4. **用户体验**：交互设计、视觉设计、响应式布局

### 协作模式

- **快速原型**：AI 生成初始代码，人工调整优化
- **增量开发**：逐步完善功能，持续迭代
- **质量保证**：AI 辅助测试，人工最终验证

## 总结

LLMChat 是一个功能完整、架构清晰、性能优秀的 AI 对话应用。项目严格遵循课题要求，使用 Vue 3 + TypeScript + Pinia 技术栈，所有核心功能均自主实现。通过合理的架构设计、性能优化和 AI 辅助开发，项目在保证质量的同时大幅提升了开发效率。
