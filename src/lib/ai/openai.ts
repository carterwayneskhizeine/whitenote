import { getAiConfig } from "./config"
import { SseLineBuffer, parseSseDataLine } from "./sse"

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

  // 确保 baseUrl 格式正确（移除末尾 /v1 或 /v1/ 及斜杠，统一由代码拼接）
  const baseUrl = config.openaiBaseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '')
  const url = `${baseUrl}/v1/chat/completions`

  // 设置 120 秒超时
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
      throw new Error('OpenAI API request timeout (120s)')
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

  // 确保 baseUrl 格式正确（移除末尾 /v1 或 /v1/ 及斜杠，统一由代码拼接）
  const baseUrl = config.openaiBaseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '')
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
    const lineBuffer = new SseLineBuffer()

    let yielded = false
    let sawReasoning = false
    let finishReason: string | null = null
    let lastDeltaKeys: string[] = []
    let rawSample = ''

    const handleLine = (line: string) => {
      const jsonStr = parseSseDataLine(line)
      if (jsonStr === null) return

      try {
        const data = JSON.parse(jsonStr)
        const delta = data.choices?.[0]?.delta
        const content = delta?.content
        if (content) {
          yielded = true
          pendingContent += content
        }
        if (delta?.reasoning_content) sawReasoning = true
        if (delta) lastDeltaKeys = Object.keys(delta)
        if (data.choices?.[0]?.finish_reason) {
          finishReason = data.choices[0].finish_reason
        }
      } catch (e) {
        // Skip invalid JSON lines
        console.warn("Failed to parse SSE line:", line.slice(0, 200))
      }
    }

    let pendingContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        if (rawSample.length < 500) rawSample += chunk

        for (const line of lineBuffer.push(chunk)) {
          handleLine(line)
          // 逐块 yield，保持流式行为
          if (pendingContent) {
            const out = pendingContent
            pendingContent = ''
            yield out
          }
        }
      }

      for (const line of lineBuffer.flush()) {
        handleLine(line)
      }
      if (pendingContent) {
        const out = pendingContent
        pendingContent = ''
        yield out
      }

      if (!yielded) {
        // 模型可能只输出了 reasoning_content，或返回了空 completion。
        // 这里记下现场信息，避免上层只看到一个空回复而无从排查。
        console.warn("[OpenAI] Stream produced no content", {
          finishReason,
          sawReasoning,
          lastDeltaKeys,
          model: options.model || config.openaiModel,
          // 响应体开头原样采样：如果是网关返回的 JSON 错误体（HTTP 200），
          // 这里能直接看出来
          rawSample: rawSample.slice(0, 300),
        })
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
