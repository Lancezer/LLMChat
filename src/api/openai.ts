import { apiClient } from '@/lib/axios'
import type { AssistantCard, ChatCompletionResponse } from '@/types/chat'
import { mockChatCompletion } from '@/utils/mockService'

export interface ChatCompletionPayload {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  temperature?: number
  stream?: boolean
}

export interface ChatCompletionResult {
  response: ChatCompletionResponse
  card?: AssistantCard
}

const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true'

export async function createChatCompletion(
  payload: ChatCompletionPayload
): Promise<{ response: ChatCompletionResponse; card?: AssistantCard }> {
  if (USE_REAL_API) {
    const { data } = await apiClient.post<ChatCompletionResponse>('/v1/chat/completions', payload)
    return { response: data }
  }

  return mockChatCompletion(payload.messages.at(-1)?.content ?? '')
}
