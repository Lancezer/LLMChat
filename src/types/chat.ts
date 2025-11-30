export type ChatRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'pending' | 'streaming' | 'sent' | 'error'

export type MessageType = 'text' | 'card' | 'file'

export interface FileAttachment {
  name: string
  size: number
  mime: string
  url?: string
  /** 本地存储 key（若文件保存在 IndexedDB 中） */
  storageKey?: string
}

export type CardType = 'contact' | 'article'

export interface AssistantCard {
  cardType: CardType
  title: string
  description: string
  actionText: string
  actionUrl: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: ChatRole
  type: MessageType
  content: string
  createdAt: number
  status: MessageStatus
  metadata?: Record<string, unknown>
  /**
   * 如果消息是 `file` 类型，attachment 将包含文件元数据
   */
  attachment?: FileAttachment
  card?: AssistantCard
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageIds: string[]
}

export interface UsageMetrics {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatCompletionChoice {
  index: number
  message: {
    role: ChatRole
    content: string
  }
  finish_reason: 'stop' | 'length'
}

export interface ChatCompletionResponse {
  id: string
  created: number
  model: string
  choices: ChatCompletionChoice[]
  usage: UsageMetrics
}

export interface StreamChunk {
  id: string
  choices: Array<{
    index: number
    delta: {
      role?: ChatRole
      content?: string
    }
    finish_reason: null | 'stop' | 'length'
  }>
}
