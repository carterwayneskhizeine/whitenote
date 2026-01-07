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
          parentId: data.parentId
        }),
      }
    )
    return response.json()
  },

  /**
   * Get comment by ID
   */
  async getComment(commentId: string): Promise<CommentResponse> {
    const response = await fetch(`${API_BASE}/comments/${commentId}`)
    return response.json()
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
}
