// API types for messages
export interface Message {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  isStarred: boolean
  isPinned: boolean
  authorId: string
  parentId: string | null
  quotedMessageId?: string | null
  quotedCommentId?: string | null
  quotedMessage?: {
    id: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string | null
      avatar: string | null
      email: string | null
    }
  } | null
  quotedComment?: {
    id: string
    content: string
    createdAt: string
    messageId: string
    author: {
      id: string
      name: string | null
      avatar: string | null
      email: string | null
    }
  } | null
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  }
  tags: Array<{
    tag: {
      id: string
      name: string
      color: string | null
    }
  }>
  medias?: Array<{
    id: string
    url: string
    type: string
    description?: string | null
  }>
  _count: {
    children: number
    comments: number
  }
  retweetCount?: number
  isRetweeted?: boolean
}

export interface CreateMessageInput {
  content: string
  parentId?: string
  quotedMessageId?: string
  quotedCommentId?: string
  tags?: string[]
  media?: Array<{ url: string; type: string }>
}

export interface UpdateMessageInput {
  content?: string
  tags?: string[]
}

export interface MessagesResponse {
  data: Message[]
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  error?: string
}

export interface MessageResponse {
  data?: Message
  error?: string
}

// API client functions
const API_BASE = '/api'

export const messagesApi = {
  /**
   * Get messages list (timeline)
   */
  async getMessages(params?: {
    page?: number
    limit?: number
    tagId?: string
    isStarred?: boolean
    isPinned?: boolean
    parentId?: string
    rootOnly?: boolean
  }): Promise<MessagesResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.tagId) searchParams.set('tagId', params.tagId)
    if (params?.isStarred !== undefined) searchParams.set('isStarred', params.isStarred.toString())
    if (params?.isPinned !== undefined) searchParams.set('isPinned', params.isPinned.toString())
    if (params?.parentId) searchParams.set('parentId', params.parentId)
    if (params?.rootOnly) searchParams.set('rootOnly', 'true')

    const response = await fetch(`${API_BASE}/messages?${searchParams.toString()}`)
    return response.json()
  },

  /**
   * Get single message by ID
   */
  async getMessage(id: string): Promise<MessageResponse> {
    const response = await fetch(`${API_BASE}/messages/${id}`)
    return response.json()
  },

  /**
   * Create new message
   */
  async createMessage(data: CreateMessageInput): Promise<MessageResponse> {
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },

  /**
   * Update message
   */
  async updateMessage(id: string, data: UpdateMessageInput): Promise<MessageResponse> {
    const response = await fetch(`${API_BASE}/messages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },

  /**
   * Delete message
   */
  async deleteMessage(id: string): Promise<{ success?: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/messages/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  /**
   * Toggle star status
   */
  async toggleStar(id: string): Promise<MessageResponse> {
    const response = await fetch(`${API_BASE}/messages/${id}/star`, {
      method: 'POST',
    })
    return response.json()
  },

  /**
   * Get starred messages
   */
  async getStarred(): Promise<MessagesResponse> {
    const response = await fetch(`${API_BASE}/messages/starred`)
    return response.json()
  },

  /**
   * Toggle pin status
   */
  async togglePin(id: string): Promise<MessageResponse> {
    const response = await fetch(`${API_BASE}/messages/${id}/pin`, {
      method: 'POST',
    })
    return response.json()
  },

  /**
   * Toggle retweet status
   */
  async toggleRetweet(id: string): Promise<MessageResponse> {
    const response = await fetch(`${API_BASE}/messages/${id}/retweet`, {
      method: 'POST',
    })
    return response.json()
  },
}
