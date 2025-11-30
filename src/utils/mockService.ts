import { nanoid } from 'nanoid'
import type { AssistantCard, ChatCompletionResponse } from '@/types/chat'
import mockData from '@/utils/mock-data.json'

// 可配置的模拟错误概率（范围 0.0 - 1.0）
// 优先读取运行时 env: VITE_MOCK_ERROR_RATE，否则默认 0
export let MOCK_ERROR_RATE = Number(import.meta.env.VITE_MOCK_ERROR_RATE ?? 0) || 0

/**
 * 在运行时修改模拟错误概率，用于测试不同失败率场景。
 * @param rate 0.0 - 1.0
 */
export function setMockErrorRate(rate: number) {
  const r = Number(rate) || 0
  MOCK_ERROR_RATE = Math.max(0, Math.min(1, r))
}

const replyTemplates = mockData.templates
const cardCatalog = mockData.cards as AssistantCard[]

const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function buildContent(prompt: string) {
  if (!prompt) return replyTemplates[0]
  const template = replyTemplates[random(0, replyTemplates.length - 1)]
  return template
}

function maybePickCard(prompt: string): AssistantCard | undefined {
  const keywords = ['联系方式', '推荐', '文章', '朋友', '资源']
  const containsKeyword = keywords.some(key => prompt.includes(key))
  const shouldPick = containsKeyword || Math.random() > 0.7
  if (!shouldPick) return undefined
  return cardCatalog[random(0, cardCatalog.length - 1)]
}

export async function mockChatCompletion(prompt: string) {
  // 在返回之前，按概率触发模拟错误，便于测试错误处理路径
  if (Math.random() < MOCK_ERROR_RATE) {
    // 抛出普通 Error，调用方会在 catch 中处理并把 message.status 设为 'error'
    throw new Error(`Mock API error (simulated) rate=${MOCK_ERROR_RATE}`)
  }

  await delay(random(300, 900))
  const card = maybePickCard(prompt)
  const content = buildContent(prompt)
  const created = Math.floor(Date.now() / 1000)
  const response: ChatCompletionResponse = {
    id: `mock-${nanoid(10)}`,
    created,
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: random(10, 80),
      completion_tokens: random(40, 180),
      total_tokens: 0,
    },
  }
  response.usage.total_tokens = response.usage.prompt_tokens + response.usage.completion_tokens

  return { response, card }
}

export interface StreamOptions {
  chunkSize?: number
  intervalRange?: [number, number]
  signal?: AbortSignal
}

export async function* streamText(
  content: string,
  options: StreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const chunkSize = Math.max(1, options.chunkSize ?? 5)
  const [minDelay, maxDelay] = options.intervalRange ?? [20, 60]
  let cursor = 0

  while (cursor < content.length) {
    if (options.signal?.aborted) {
      throw new DOMException('Stream aborted', 'AbortError')
    }
    const nextCursor = Math.min(content.length, cursor + chunkSize)
    const chunk = content.slice(cursor, nextCursor)
    cursor = nextCursor
    await delay(random(minDelay, maxDelay))
    // 在流式传输中也可能发生模拟错误（中途失败），概率同 MOCK_ERROR_RATE
    if (Math.random() < MOCK_ERROR_RATE) {
      throw new Error(`Mock stream error (simulated) rate=${MOCK_ERROR_RATE}`)
    }
    yield chunk
  }
}

export { delay }
