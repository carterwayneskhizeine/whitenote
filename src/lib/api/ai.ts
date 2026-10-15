import {
  AIChatInput,
  AIChatResponse,
  AIEnhanceInput,
  AIEnhanceResponse,
} from '@/types/api'

const API_BASE = '/api'

export const aiApi = {
  /**
   * AI chat (standard or RAG mode)
   */
  async chat(data: AIChatInput): Promise<AIChatResponse> {
    const response = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    // 非 2xx 时 response.json() 返回的是 { error } 而不是 { data }，
    // 调用方若不检查就会把失败当成成功。这里显式抛错，避免错误被静默吞掉。
    if (!response.ok) {
      const raw = await response.text()
      let message = `AI 请求失败（HTTP ${response.status}）`
      try {
        const parsed = raw ? JSON.parse(raw) : null
        if (typeof parsed?.error === 'string' && parsed.error) {
          message = parsed.error
        }
      } catch {
        // body 不是 JSON，保留默认提示
      }
      throw new Error(message)
    }

    return response.json()
  },

  /**
   * AI text enhancement (summarize, translate, expand, polish)
   */
  async enhance(data: AIEnhanceInput): Promise<AIEnhanceResponse> {
    const response = await fetch(`${API_BASE}/ai/enhance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },
}
