import {
  Template,
  CreateTemplateInput,
  TemplatesResponse,
  TemplateResponse,
} from '@/types/api'

const API_BASE = '/api'

export const templatesApi = {
  /**
   * Get all templates (built-in + user custom)
   */
  async getTemplates(): Promise<TemplatesResponse> {
    const response = await fetch(`${API_BASE}/templates`)
    return response.json()
  },

  /**
   * Create custom template
   */
  async createTemplate(data: CreateTemplateInput): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE}/templates/${id}`)
    return response.json()
  },

  /**
   * Delete template
   */
  async deleteTemplate(
    id: string
  ): Promise<{ success?: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },
}
