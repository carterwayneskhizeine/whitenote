// 分页参数
export interface PaginationParams {
  page?: number
  limit?: number
}

// 消息过滤参数
export interface MessageFilters {
  tagId?: string
  isStarred?: boolean
  isPinned?: boolean
  parentId?: string | null  // null = 仅根消息
  search?: string
}

// 创建消息参数
export interface CreateMessageInput {
  content: string
  title?: string
  parentId?: string
  tags?: string[]  // 标签名称数组
}

// 更新消息参数
export interface UpdateMessageInput {
  content?: string
  title?: string
  tags?: string[]
}

// API 响应
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// 消息详情 (包含关联数据)
export interface MessageWithRelations {
  id: string
  title: string | null
  content: string
  createdAt: Date
  updatedAt: Date
  isStarred: boolean
  isPinned: boolean
  authorId: string
  parentId: string | null
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
  _count: {
    children: number
    comments: number
  }
}

// ==================== Tags ====================
export interface Tag {
  id: string
  name: string
  color: string | null
  count?: number
}

export interface TagWithMessages extends Tag {
  messages?: MessageWithRelations[]
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface TagsResponse {
  data: Tag[]
  error?: string
}

// ==================== Comments ====================
export interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  messageId: string
  authorId: string
  isAIBot: boolean
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  }
  parentId?: string | null
  _count?: {
    replies: number
  }
}

export interface CreateCommentInput {
  content: string
  messageId: string
  parentId?: string
}

export interface CommentsResponse {
  data: Comment[]
  error?: string
}

export interface CommentResponse {
  data?: Comment
  error?: string
}

// ==================== Templates ====================
export interface Template {
  id: string
  name: string
  content: string
  description: string | null
  authorId: string
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateInput {
  name: string
  content: string
  description?: string
}

export interface TemplatesResponse {
  data: Template[]
  error?: string
}

export interface TemplateResponse {
  data?: Template
  error?: string
}

// ==================== Search ====================
export interface SearchParams {
  q: string
  page?: number
  limit?: number
}

export interface SearchResponse {
  data: MessageWithRelations[]
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  error?: string
}

// ==================== AI Config ====================
export interface AIConfig {
  id: string
  userId: string
  openaiBaseUrl: string
  openaiApiKey: string
  openaiModel: string
  enableRag: boolean
  ragTimeFilterStart: Date | null
  ragTimeFilterEnd: Date | null
  ragflowBaseUrl: string
  ragflowApiKey: string
  ragflowChatId: string
  ragflowDatasetId: string
  enableAutoTag: boolean
  autoTagModel: string
  enableBriefing: boolean
  briefingModel: string
  briefingTime: string
  aiPersonality: string
  aiExpertise: string | null
  enableLinkSuggestion: boolean
  updatedAt: string
}

export interface UpdateAIConfigInput {
  openaiBaseUrl?: string
  openaiApiKey?: string
  openaiModel?: string
  enableRag?: boolean
  ragflowBaseUrl?: string
  ragflowApiKey?: string
  ragflowChatId?: string
  ragflowDatasetId?: string
  ragTimeFilterStart?: string
  ragTimeFilterEnd?: string
  enableAutoTag?: boolean
  autoTagModel?: string
  enableBriefing?: boolean
  briefingModel?: string
  briefingTime?: string
  aiPersonality?: string
  aiExpertise?: string
  enableLinkSuggestion?: boolean
}

export interface AIConfigResponse {
  data?: AIConfig
  error?: string
  message?: string
}

// ==================== AI Chat ====================
export interface AIChatInput {
  messageId: string
  content: string
}

export interface AIChatResponse {
  data?: {
    comment: Comment
    references?: Array<{
      content: string
      source: string
    }>
  }
  error?: string
}

export interface AIEnhanceInput {
  action: 'summarize' | 'translate' | 'expand' | 'polish'
  content: string
  target?: string
}

export interface AIEnhanceResponse {
  data?: {
    result: string
  }
  error?: string
}

export interface ConnectionTestResponse {
  success?: boolean
  message?: string
  error?: string
}
