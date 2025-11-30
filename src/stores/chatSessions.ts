/*
  Store: chatSessions
  说明: 管理会话列表（创建/删除/重命名/选中），并维护每个会话的 messageId 列表。
  使用: 其他 store（如 `chat`）会与其协作同步 activeSessionId 与 messageIds。
*/
import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import type { ChatSession } from '@/types/chat'
import { readInitialChatState } from './chatPersistence'

const persisted = readInitialChatState()

interface ChatSessionsState {
  sessions: ChatSession[]
  activeSessionId: string | null
}

export const useChatSessionsStore = defineStore('chatSessions', {
  state: (): ChatSessionsState => ({
    sessions: persisted.sessions,
    activeSessionId: persisted.sessions[0]?.id ?? null,
  }),
  getters: {
    activeSession(state) {
      return state.sessions.find(session => session.id === state.activeSessionId) ?? null
    },
  },
  actions: {
    createSession(title?: string) {
      const now = Date.now()
      // 找到现有对话中的所有序号
      const existingNumbers = this.sessions
        .map(s => {
          const match = s.title.match(/^新的对话 (\d+)$/)
          return match ? parseInt(match[1] ?? '0', 10) : 0
        })
        .filter(n => n > 0)
        .sort((a, b) => a - b)

      // 找到缺失的最小编号
      let nextNumber = 1
      for (const num of existingNumbers) {
        if (num === nextNumber) {
          nextNumber++
        } else if (num > nextNumber) {
          break
        }
      }

      const newSession: ChatSession = {
        id: nanoid(10),
        title: title?.trim() || `新的对话 ${nextNumber}`,
        createdAt: now,
        updatedAt: now,
        messageIds: [],
      }
      this.sessions.unshift(newSession)
      this.activeSessionId = newSession.id
      return newSession
    },
    setActiveSession(id: string) {
      this.activeSessionId = id
    },
    renameSession(id: string, title: string) {
      const target = this.sessions.find(session => session.id === id)
      if (!target) return
      target.title = title
      target.updatedAt = Date.now()
    },
    deleteSession(id: string) {
      this.sessions = this.sessions.filter(session => session.id !== id)
      if (this.activeSessionId === id) {
        this.activeSessionId = this.sessions[0]?.id ?? null
      }
    },
    touchSession(id: string) {
      const target = this.sessions.find(session => session.id === id)
      if (target) {
        target.updatedAt = Date.now()
      }
    },
    appendMessageId(sessionId: string, messageId: string) {
      const target = this.sessions.find(session => session.id === sessionId)
      if (target && !target.messageIds.includes(messageId)) {
        target.messageIds.push(messageId)
        target.updatedAt = Date.now()
      }
    },
    replaceMessageIds(sessionId: string, messageIds: string[]) {
      const target = this.sessions.find(session => session.id === sessionId)
      if (target) {
        target.messageIds = [...messageIds]
        target.updatedAt = Date.now()
      }
    },
  },
})
