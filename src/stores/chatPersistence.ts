/*
  Module: chatPersistence
  说明: 负责将会话与消息状态序列化到本地存储并从存储中读取初始状态。
  提供: `readInitialChatState`, `persistChatState`, `makePersistedState` 三个薄封装。
*/
import type { ChatMessage, ChatSession } from '@/types/chat'
import { loadFromStorage, saveToStorage } from '@/utils/storage'

export interface PersistedChatState {
  sessions: ChatSession[]
  messages: Record<string, ChatMessage[]>
}

const defaultState: PersistedChatState = {
  sessions: [],
  messages: {},
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export function readInitialChatState() {
  return loadFromStorage<PersistedChatState>(clone(defaultState))
}

export function persistChatState(state: PersistedChatState) {
  saveToStorage(state)
}

export function makePersistedState(
  sessions: ChatSession[],
  messages: Record<string, ChatMessage[]>
): PersistedChatState {
  return { sessions: clone(sessions), messages: clone(messages) }
}
