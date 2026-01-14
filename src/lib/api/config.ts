import {
  AIConfig,
  UpdateAIConfigInput,
  AIConfigResponse,
  ConnectionTestResponse,
} from '@/types/api'
import { handle401Error } from '@/lib/auth-redirect'

const API_BASE = '/api'

/**
 * 检查响应状态，如果是 401 则跳转到登录页
 */
async function handleResponse(response: Response): Promise<Response> {
  if (response.status === 401) {
    // 使用统一的错误处理函数
    handle401Error()
    throw new Error('Unauthorized')
  }
  return response
}

export const configApi = {
  /**
   * Get AI configuration
   */
  async getConfig(): Promise<AIConfigResponse> {
    const response = await fetch(`${API_BASE}/config`)
    await handleResponse(response)
    return response.json()
  },

  /**
   * Update AI configuration
   */
  async updateConfig(data: UpdateAIConfigInput): Promise<AIConfigResponse> {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await handleResponse(response)
    return response.json()
  },

  /**
   * Test RAGFlow connection
   */
  async testConnection(): Promise<ConnectionTestResponse> {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'POST',
    })
    await handleResponse(response)
    return response.json()
  },
}
