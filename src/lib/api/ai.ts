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
