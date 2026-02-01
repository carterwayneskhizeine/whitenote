import {
  Comment,
  CreateCommentInput,
  CommentsResponse,
  CommentResponse,
} from '@/types/api'

const API_BASE = '/api'

export const commentsApi = {
  /**
   * Get comments for a message
   */
  async getComments(messageId: string): Promise<CommentsResponse> {
    const response = await fetch(`${API_BASE}/messages/${messageId}/comments`)
    return response.json()
  },

  /**
   * Create new comment
   */
  async createComment(data: CreateCommentInput): Promise<CommentResponse> {
    const response = await fetch(
      `${API_BASE}/messages/${data.messageId}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: data.content,
          parentId: data.parentId,
          media: data.media,
        }),
      }
    )
    return response.json()
  },

  /**
   * Get comment by ID
   */
  async getComment(commentId: string): Promise<CommentResponse> {
    console.log('[commentsApi] Fetching comment:', commentId)
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
      // 禁用缓存确保获取最新数据
      cache: 'no-store',
    })
    const result = await response.json()
    console.log('[commentsApi] Fetched comment:', result.data?.id, result.data?.content?.substring(0, 50))
    return result
  },

  /**
   * Get comment path (ancestors chain)
   */
  async getCommentPath(commentId: string): Promise<CommentsResponse> {
    const response = await fetch(`${API_BASE}/comments/${commentId}/path`)
    return response.json()
  },

  /**
   * Get child comments (replies) of a comment
   */
  async getChildComments(parentId: string): Promise<CommentsResponse> {
    const response = await fetch(`${API_BASE}/comments/${parentId}/children`)
    return response.json()
  },

  /**
   * Toggle star status
   */
  async toggleStar(commentId: string): Promise<CommentResponse> {
    const response = await fetch(`${API_BASE}/comments/${commentId}/star`, {
      method: 'POST',
    })
    return response.json()
  },

  /**
   * Get starred comments
   */
  async getStarredComments(): Promise<CommentsResponse> {
    const response = await fetch(`${API_BASE}/comments/starred`)
    return response.json()
  },

  /**
   * Toggle retweet status
   */
  async toggleRetweet(commentId: string): Promise<CommentResponse> {
    const response = await fetch(`${API_BASE}/comments/${commentId}/retweet`, {
      method: 'POST',
    })
    return response.json()
  },

  /**
   * Delete comment
   */
  async deleteComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  /**
   * Update comment
   */
  async updateComment(commentId: string, data: { content: string; tags?: string[] }): Promise<CommentResponse> {
    console.log('[commentsApi] Updating comment:', commentId, 'with data:', data)
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // 禁用缓存确保获取最新数据
      cache: 'no-store',
      body: JSON.stringify(data),
    })
    const result = await response.json()
    console.log('[commentsApi] Update result:', result.data?.id, result.data?.content?.substring(0, 50))
    return result
  },
}
