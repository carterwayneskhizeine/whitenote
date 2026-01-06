import {
  AIConfig,
  UpdateAIConfigInput,
  AIConfigResponse,
  ConnectionTestResponse,
} from '@/types/api'

const API_BASE = '/api'

export const configApi = {
  /**
   * Get AI configuration
   */
  async getConfig(): Promise<AIConfigResponse> {
    const response = await fetch(`${API_BASE}/config`)
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
    return response.json()
  },

  /**
   * Test RAGFlow connection
   */
  async testConnection(): Promise<ConnectionTestResponse> {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'POST',
    })
    return response.json()
  },
}
