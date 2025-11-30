/*
  Store: chat
  说明: 管理消息按会话分组的状态、发送流程（含流式生成）、以及消息持久化。
  主要职责:
  - 存储并检索每个会话的消息数组
  - 处理发送（文本/文件）与流式写入到占位消息
  - 与 `chatSessions` 协作维护会话元数据
*/
import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import type { ChatMessage, MessageStatus } from '@/types/chat'
import { createChatCompletion } from '@/api/openai'
import { saveFile } from '@/lib/fileStorage'
import { streamText } from '@/utils/mockService'
import { makePersistedState, persistChatState, readInitialChatState } from './chatPersistence'
import { useChatSessionsStore } from './chatSessions'
import { clearAllFiles } from '@/lib/fileStorage'
import { clearStorage } from '@/utils/storage'

const persisted = readInitialChatState()

interface ChatState {
  messagesBySession: Record<string, ChatMessage[]>
  streamingMessageId: string | null
  isSending: boolean
  abortController: AbortController | null
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    messagesBySession: persisted.messages,
    streamingMessageId: null,
    isSending: false,
    abortController: null,
  }),
  getters: {
    messages: state => {
      const sessionsStore = useChatSessionsStore()
      const sessionId = sessionsStore.activeSessionId
      if (!sessionId) return []
      return state.messagesBySession[sessionId] ?? []
    },
  },
  actions: {
    ensureSession() {
      const sessionsStore = useChatSessionsStore()
      if (sessionsStore.activeSessionId) return sessionsStore.activeSessionId
      return this.startNewSession()
    },
    startNewSession(title?: string) {
      const sessionsStore = useChatSessionsStore()
      const newSession = sessionsStore.createSession(title)
      this.messagesBySession[newSession.id] = []
      this.persist()
      return newSession.id
    },
    getMessages(sessionId: string) {
      if (!this.messagesBySession[sessionId]) {
        this.messagesBySession[sessionId] = []
      }
      return this.messagesBySession[sessionId]
    },
    appendMessage(sessionId: string, message: ChatMessage) {
      const list = this.getMessages(sessionId)
      list.push(message)
      const sessionsStore = useChatSessionsStore()
      sessionsStore.appendMessageId(sessionId, message.id)
    },
    updateMessage(sessionId: string, messageId: string, updater: (msg: ChatMessage) => void) {
      const list = this.getMessages(sessionId)
      const target = list.find(msg => msg.id === messageId)
      if (target) {
        updater(target)
      }
    },
    setMessageStatus(sessionId: string, messageId: string, status: MessageStatus) {
      this.updateMessage(sessionId, messageId, msg => {
        msg.status = status
      })
    },
    async sendMessage(content: string) {
      const trimmed = content.trim()
      if (!trimmed) return
      const sessionsStore = useChatSessionsStore()
      const sessionId = this.ensureSession()

      const userMessage: ChatMessage = {
        id: nanoid(12),
        sessionId,
        role: 'user',
        type: 'text',
        content: trimmed,
        createdAt: Date.now(),
        status: 'sent',
      }
      this.appendMessage(sessionId, userMessage)

      const placeholder: ChatMessage = {
        id: nanoid(12),
        sessionId,
        role: 'assistant',
        type: 'text',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
      }
      this.appendMessage(sessionId, placeholder)
      this.streamingMessageId = placeholder.id
      this.isSending = true
      this.persist()

      const contextMessages = this.buildContextMessages(sessionId)

      try {
        this.abortController?.abort()
        this.abortController = new AbortController()
        const { response, card } = await createChatCompletion({
          model: 'gpt-4o-mini',
          messages: contextMessages,
          stream: true,
        })
        const assistantContent = response.choices[0]?.message.content ?? ''
        await this.streamIntoMessage(sessionId, placeholder.id, assistantContent)
        this.setMessageStatus(sessionId, placeholder.id, 'sent')
        this.streamingMessageId = null
        if (card) {
          this.appendMessage(sessionId, {
            id: nanoid(12),
            sessionId,
            role: 'assistant',
            type: 'card',
            content: card.title,
            createdAt: Date.now(),
            status: 'sent',
            card,
          })
        }
        sessionsStore.touchSession(sessionId)
        this.persist()
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') {
          this.setMessageStatus(sessionId, placeholder.id, 'error')
        } else {
          this.setMessageStatus(sessionId, placeholder.id, 'error')
          console.error('[chat] send failed', error)
        }
        this.streamingMessageId = null
        this.persist()
        throw error
      } finally {
        this.isSending = false
        this.abortController = null
      }
    },
    async sendFile(file: File) {
      return this.sendFiles([file])
    },

    async sendFiles(files: File[]) {
      if (!files || files.length === 0) return
      const sessionsStore = useChatSessionsStore()
      const sessionId = this.ensureSession()
      this.isSending = true
      try {
        for (const file of files) {
          const msgId = nanoid(12)
          const storageKey = `file_${msgId}`
          // persist blob into IndexedDB so it survives page reloads
          try {
            await saveFile(storageKey, file)
          } catch (e) {
            console.warn('[fileStorage] save failed', e)
          }
          const fileMessage = {
            id: msgId,
            sessionId,
            role: 'user' as const,
            type: 'file' as const,
            content: file.name,
            createdAt: Date.now(),
            status: 'sent' as const,
            metadata: {
              size: file.size,
              mime: file.type,
            },
            attachment: {
              name: file.name,
              size: file.size,
              mime: file.type,
              storageKey,
            },
          }
          this.appendMessage(sessionId, fileMessage)
        }
        // create assistant placeholder and stream response (same flow as sendMessage)
        const placeholder: ChatMessage = {
          id: nanoid(12),
          sessionId,
          role: 'assistant',
          type: 'text',
          content: '',
          createdAt: Date.now(),
          status: 'streaming',
        }
        this.appendMessage(sessionId, placeholder)
        this.streamingMessageId = placeholder.id
        this.persist()

        const contextMessages = this.buildContextMessages(sessionId)
        // create a user-visible summary only for the API (do not append to UI)
        const uploadedFiles = files
          .map(f => `${f.name} (${Math.round(f.size / 1024)} KB)`)
          .join(', ')
        const summaryForApi = `已上传文件：${uploadedFiles}`

        try {
          this.abortController?.abort()
          this.abortController = new AbortController()
          const { response, card } = await createChatCompletion({
            model: 'gpt-4o-mini',
            messages: [...contextMessages, { role: 'user', content: summaryForApi }],
            stream: true,
          })
          const assistantContent = response.choices[0]?.message.content ?? ''
          await this.streamIntoMessage(sessionId, placeholder.id, assistantContent)
          this.setMessageStatus(sessionId, placeholder.id, 'sent')
          this.streamingMessageId = null
          if (card) {
            this.appendMessage(sessionId, {
              id: nanoid(12),
              sessionId,
              role: 'assistant',
              type: 'card',
              content: card.title,
              createdAt: Date.now(),
              status: 'sent',
              card,
            })
          }
        } catch (error) {
          if ((error as DOMException).name === 'AbortError') {
            this.setMessageStatus(sessionId, placeholder.id, 'error')
          } else {
            this.setMessageStatus(sessionId, placeholder.id, 'error')
            console.error('[chat] sendFiles assistant generation failed', error)
          }
          this.streamingMessageId = null
          this.persist()
        }

        sessionsStore.touchSession(sessionId)
        this.persist()
      } catch (error) {
        console.error('[chat] file send failed', error)
        throw error
      } finally {
        this.isSending = false
      }
    },
    buildContextMessages(sessionId: string) {
      const sessionsStore = useChatSessionsStore()
      sessionsStore.setActiveSession(sessionId)
      const allMessages = this.getMessages(sessionId)
      const textMessages = allMessages.filter(
        msg => msg.type === 'text' && msg.status !== 'streaming'
      )
      const slice = textMessages.slice(-8)
      return slice.map(msg => ({ role: msg.role, content: msg.content }))
    },
    async streamIntoMessage(sessionId: string, messageId: string, content: string) {
      this.updateMessage(sessionId, messageId, msg => {
        msg.content = ''
        msg.status = 'streaming'
      })
      try {
        for await (const chunk of streamText(content, {
          chunkSize: 4,
          signal: this.abortController?.signal,
        })) {
          this.updateMessage(sessionId, messageId, msg => {
            msg.content += chunk
          })
        }
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          throw error
        }
      }
    },
    async regenerateAssistantMessage(messageId: string) {
      const sessionsStore = useChatSessionsStore()
      const sessionId = sessionsStore.activeSessionId
      if (!sessionId) return
      const list = this.getMessages(sessionId)
      const index = list.findIndex(msg => msg.id === messageId)
      if (index === -1) return
      const previousUser = [...list]
        .slice(0, index)
        .reverse()
        .find(msg => msg.role === 'user')
      if (!previousUser) return
      // 在重新生成前，移除紧随其后的所有 assistant card（这些被视为附属卡片）
      let removeCount = 0
      while (
        list[index + 1 + removeCount] !== undefined &&
        list[index + 1 + removeCount]?.role === 'assistant' &&
        list[index + 1 + removeCount]?.type === 'card'
      ) {
        removeCount++
      }
      if (removeCount > 0) {
        list.splice(index + 1, removeCount)
        // 更新会话中的 messageIds 映射
        sessionsStore.replaceMessageIds(
          sessionId,
          list.map(m => m.id)
        )
        this.persist()
      }

      this.setMessageStatus(sessionId, messageId, 'streaming')
      this.updateMessage(sessionId, messageId, msg => {
        msg.content = ''
      })
      try {
        this.abortController?.abort()
        this.abortController = new AbortController()
        const { response, card } = await createChatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: previousUser.content }],
          stream: true,
        })
        const assistantContent = response.choices[0]?.message.content ?? ''
        await this.streamIntoMessage(sessionId, messageId, assistantContent)
        this.setMessageStatus(sessionId, messageId, 'sent')
        // 如果这次重生成返回了 card，将其追加为新的附属卡片
        if (card) {
          this.appendMessage(sessionId, {
            id: nanoid(12),
            sessionId,
            role: 'assistant',
            type: 'card',
            content: card.title,
            createdAt: Date.now(),
            status: 'sent',
            card,
          })
        }
        this.persist()
      } catch {
        this.setMessageStatus(sessionId, messageId, 'error')
        this.persist()
      } finally {
        this.abortController = null
      }
    },
    persist() {
      const sessionsStore = useChatSessionsStore()
      const snapshot = makePersistedState(sessionsStore.sessions, this.messagesBySession)
      persistChatState(snapshot)
    },
    resetAll() {
      const sessionsStore = useChatSessionsStore()
      // clear IndexedDB stored files
      try {
        void clearAllFiles()
      } catch (e) {
        console.warn('[chat] clearAllFiles failed', e)
      }
      // clear persisted localStorage
      try {
        clearStorage()
      } catch (e) {
        console.warn('[chat] clearStorage failed', e)
      }

      // reset in-memory state and persist empty snapshot
      sessionsStore.sessions = []
      sessionsStore.activeSessionId = null
      this.messagesBySession = {}
      this.persist()
    },
    async deleteSession(sessionId: string) {
      const sessionsStore = useChatSessionsStore()
      // clean up any stored files for messages in this session
      try {
        const list = this.getMessages(sessionId)
        for (const msg of list) {
          if (msg?.type === 'file' && msg.attachment?.storageKey) {
            try {
              await this.deleteMessageFileStorage(msg.id)
            } catch {
              // ignore individual failures
            }
          }
        }
      } catch {
        // ignore
      }

      sessionsStore.deleteSession(sessionId)
      delete this.messagesBySession[sessionId]
      this.persist()
    },
    async deleteMessageFileStorage(messageId: string) {
      // optional helper: delete stored blob in IndexedDB when a message/file is removed
      try {
        const key = `file_${messageId}`
        // import dynamically to avoid circular issues
        const mod = await import('@/lib/fileStorage')
        await mod.deleteFile(key)
      } catch {
        // ignore
      }
    },
  },
})
