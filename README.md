# LLMChat

Vue 3 + TypeScript + Pinia + Axios 实现的自研对话面板。界面布局、状态管理、流式渲染与 Mock API 均自行实现，未依赖任何第三方聊天 UI 组件库。

## ✨ 功能亮点

- ⚙️ **OpenAI Chat Completions Mock**：请求/响应结构与 OpenAI 保持一致，数据来自 `src/utils/mock-data.json` 并通过 `mockService` 生成 Markdown、卡片与 Usage 信息。
- 💬 **双列布局 + 响应式体验**：桌面端提供固定侧边栏，移动端支持抽屉式会话列表与遮罩层。
- 📜 **富文本渲染**：`Markdown-it + highlight.js` 解析 AI 回复，代码块内置复制按钮，常见 Markdown 语法全部支持。
- 🧠 **流式打字机效果**：`streamText` 生成器按字符推送内容，可感知 Abort 信号并回退状态，模拟 SSE/ReadableStream。
- 📎 **消息卡片与快捷操作**：AI 回复可输出联系/文章卡片；所有 AI 文本消息提供“复制内容”“重新生成/重试”按钮。
- 💾 **本地持久化**：会话与消息通过 `localStorage` 保存，刷新页面可恢复；侧边栏提供一键“重置 Demo”。
- 🚦 **状态管理与异常处理**：消息支持 `pending/streaming/sent/error` 状态，错误时在气泡内显示提示并允许重试。
- 📚 **长列表优化**：当消息超过 200 条时，仅渲染最新窗口，提供“加载更早内容”按钮以按需扩展，可保障滚动性能。

更多架构细节见 `docs/DESIGN.md`。

## 🧱 技术选型

- **框架**：Vue 3 (`<script setup>`)，便于组合式逻辑。
- **状态**：Pinia 拆分 `auth`、`chatSessions`、`chat` 三个 Store，`chatPersistence` 统一读写 `localStorage`。
- **网络**：Axios 封装于 `src/lib/axios.ts`，未来切换真实 OpenAI API 时仅需调整 `VITE_USE_REAL_API`。
- **富文本**：`markdown-it` + `highlight.js` + 自定义复制按钮，保障 Markdown + 代码高亮体验。
- **ID 生成**：`nanoid` 用于会话、消息、流式 chunk 的唯一标识。

## 📂 重要目录

```
src/
  api/openai.ts          # OpenAI 风格接口封装（mock 或真实接口）
  components/chat/       # Sidebar / Thread / Markdown / Card / Composer 等 UI 组件
  stores/                # auth + chatSessions + chat + 持久化工具
  utils/mockService.ts   # Mock 回复、流式生成器、随机卡片逻辑
  utils/mock-data.json   # 可配置的演示数据与卡片内容
  views/ChatPage.vue     # 顶层布局与响应式逻辑
```

## 🚀 快速开始

```bash
npm install          # 安装依赖（首次必需）
npm run dev          # 本地开发，默认 http://localhost:5173

npm run lint         # ESLint + Prettier
npm run type-check   # vue-tsc 类型检查
npm run build        # 产物构建
```

> **提示**：由于当前仓库包含 Mock 数据且未接入真实 API，联网环境不可用时依然可以本地开发。

## 🔌 Chat Completions Mock

- **请求格式**：`POST /v1/chat/completions`，包含 `model / messages / stream` 字段。
- **响应结构**：遵循 OpenAI 通用字段（`id/choices/usage`）。当 `stream: true` 时，由 `streamText` 逐字符推送。
- **卡片渲染**：`mock-data.json` 中配置了 `contact/article` 两种卡片，满足“渲染特定卡片 + 点击跳转”的需求。

## 💾 持久化策略

- `chatPersistence.ts` 将 `{ sessions, messages }` 保存到 `localStorage` `llmchat:v1` 下。
- `chatStore.persist()` 在所有写操作后触发，保证刷新/关闭页面后仍能恢复对话。
- 侧边栏“重置”按钮会清空本地数据并回到初始状态。

## 🧪 P1 能力实现

- 快捷操作：“复制内容”“重新生成/重试”均在消息气泡内可用，复制使用原生 Clipboard API。
- 异常处理：Mock 请求失败或用户手动终止后，消息标记为 `error` 并提示重试。
- 长列表性能：当消息 > 100 条时仅渲染尾部窗口，提供“加载更早的内容”按钮，避免一次性渲染巨大 DOM。

## 🤖 AI 协作说明

开发过程中借助 AI 编程助手（例如 GitHub Copilot）生成部分样板代码（如 Pinia Store 模板、CSS 布局思路）。所有关键逻辑（数据结构、Mock API、状态流转、UI 架构）均由人工审阅与改写，确保满足“自研对话流”与“不可引用聊天 UI 组件库”的约束。

## ✅ 后续可拓展方向

1. 接入真实 OpenAI/自建 LLM 服务，只需在 `.env` 中开启 `VITE_USE_REAL_API` 并配置密钥。
2. 在线程区域接入虚拟滚动（IntersectionObserver + 缓存高度）进一步提升极端长列表性能。
3. 扩展多模态输入（图片/音频）、会话标签、上下文裁剪策略等高级玩法。
