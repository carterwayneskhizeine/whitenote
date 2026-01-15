import { Tag, CreateTagInput, TagsResponse, ApiResponse } from '@/types/api'

const API_BASE = '/api'

export const tagsApi = {
  /**
   * Get all tags (with message counts, sorted by popularity)
   */
  async getTags(): Promise<TagsResponse> {
    const response = await fetch(`${API_BASE}/tags`)
    return response.json()
  },

  /**
   * Create new tag
   */
  async createTag(data: CreateTagInput): Promise<ApiResponse<Tag>> {
    const response = await fetch(`${API_BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },

  /**
   * Get messages by tag ID
   */
  async getTagMessages(
    tagId: string,
    params?: { page?: number; limit?: number }
  ): Promise<ApiResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const response = await fetch(
      `${API_BASE}/tags/${tagId}/messages?${searchParams.toString()}`
    )
    return response.json()
  },

  /**
   * Cleanup unused tags (tags with zero messages)
   */
  async cleanupUnusedTags(): Promise<
    ApiResponse<{ deletedCount: number; deletedTags: Array<{ id: string; name: string }> }>
  > {
    const response = await fetch(`${API_BASE}/tags`, {
      method: 'DELETE',
    })
    return response.json()
  },

  /**
   * Get popular tags (sorted by usage count)
   */
  async getPopularTags(limit?: number): Promise<ApiResponse<Array<Tag & { count: number }>>> {
    const searchParams = new URLSearchParams()
    if (limit) searchParams.set('limit', limit.toString())

    const response = await fetch(
      `${API_BASE}/tags/popular?${searchParams.toString()}`
    )
    return response.json()
  },
}
