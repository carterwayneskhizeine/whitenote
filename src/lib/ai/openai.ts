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

  const response = await fetch(`${config.openaiBaseUrl}/v1/chat/completions`, {
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
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ""
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
