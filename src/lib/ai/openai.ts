import { getAiConfig } from "./config"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatOptions {
  userId: string  // 必须传入用户 ID
  messages: ChatMessage[]
  model?: string // 可选：覆盖默认模型
  stream?: boolean
}

/**
 * 调用 OpenAI 兼容接口 (标准模式)
 * 每次调用都读取用户的最新配置 (热更新)
 */
export async function callOpenAI(options: ChatOptions): Promise<string> {
  // 获取用户的配置
  const config = await getAiConfig(options.userId)

  if (!config.openaiApiKey) {
    throw new Error("OpenAI API key not configured")
  }

  // 确保 baseUrl 格式正确（移除末尾斜杠）
  const baseUrl = config.openaiBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/v1/chat/completions`

  // 设置 60 秒超时
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: options.model || config.openaiModel,
        messages: options.messages,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ""
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('OpenAI API request timeout (60s)')
    }
    console.error('[OpenAI] Request failed:', error)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 构建 AI 人设系统提示词 (热更新)
 * @param userId 用户 ID
 */
export async function buildSystemPrompt(userId: string): Promise<string> {
  const config = await getAiConfig(userId)

  const personalities: Record<string, string> = {
    friendly: "你是一个友好、热情的 AI 助手，语气亲切自然。",
    professional: "你是一个专业、严谨的 AI 助手。",
    casual: "你是一个轻松、幽默的 AI 伙伴，喜欢用轻松的方式交流。",
  }

  let prompt = personalities[config.aiPersonality] || personalities.friendly
  prompt += " You are a helpful assistant. Your name is GoldieRill."

  if (config.aiExpertise) {
    prompt += ` 你在 ${config.aiExpertise} 领域有深入的了解。`
  }

  return prompt
}

/**
 * 调用 OpenAI 兼容接口 (流式模式)
 * @returns AsyncGenerator<string> 逐块返回文本内容
 */
export async function* callOpenAIStream(options: ChatOptions): AsyncGenerator<string> {
  const config = await getAiConfig(options.userId)

  if (!config.openaiApiKey) {
    throw new Error("OpenAI API key not configured")
  }

  // 确保 baseUrl 格式正确（移除末尾斜杠）
  const baseUrl = config.openaiBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/v1/chat/completions`

  // 设置 120 秒超时（流式响应可能需要更长时间）
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: options.model || config.openaiModel,
        messages: options.messages,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    // 创建可读流
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("Response body is not readable")
    }

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === "data: [DONE]") continue
          if (!trimmed.startsWith("data: ")) continue

          try {
            const jsonStr = trimmed.slice(6) // Remove "data: " prefix
            const data = JSON.parse(jsonStr)
            const content = data.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch (e) {
            // Skip invalid JSON lines
            console.warn("Failed to parse SSE line:", trimmed)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('OpenAI API stream timeout (120s)')
    }
    console.error('[OpenAI] Stream failed:', error)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
