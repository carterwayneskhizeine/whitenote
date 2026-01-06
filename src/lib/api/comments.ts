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
        body: JSON.stringify({ content: data.content }),
      }
    )
    return response.json()
  },
}
