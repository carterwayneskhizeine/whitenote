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
  workspaceId?: string | null  // Workspace ID 过滤
  search?: string
}

// 创建消息参数
export interface CreateMessageInput {
  content: string
  title?: string
  tags?: string[]  // 标签名称数组
  workspaceId?: string  // Workspace ID
  quotedMessageId?: string
  quotedCommentId?: string
  media?: Array<{ url: string; type: string }>
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
  authorId: string | null
  workspaceId: string | null
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  } | null
  workspace?: {
    id: string
    name: string
  } | null
  tags: Array<{
    tag: {
      id: string
      name: string
      color: string | null
    }
  }>
  _count: {
    comments: number
  }
  retweetCount?: number
  isRetweeted?: boolean
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
// 引用的消息（简化版）
export interface QuotedMessage {
  id: string
  content: string
  createdAt: string
  updatedAt?: string
  messageId?: string
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  } | null
  medias?: Array<{
    id: string
    url: string
    type: string
    description?: string | null
  }>
}

export interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  messageId: string
  authorId: string
  isStarred: boolean
  isAIBot: boolean
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  }
  parentId?: string | null
  quotedMessageId?: string | null
  quotedMessage?: QuotedMessage | null
  tags?: Array<{
    tag: {
      id: string
      name: string
      color?: string | null
    }
  }>
  medias?: Array<{
    id: string
    url: string
    type: string
    description?: string | null
  }>
  _count?: {
    replies: number
    retweets: number
  }
  retweetCount?: number
  isRetweeted?: boolean
  messageAuthorCommentSortOrder?: boolean
}

export interface CreateCommentInput {
  content: string
  messageId: string
  parentId?: string
  media?: Array<{ url: string; type: string }>
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

export interface UpdateTemplateInput {
  name?: string
  content?: string
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
  type?: 'all' | 'messages' | 'comments'
}

// 搜索结果中的评论类型
export interface CommentWithRelations {
  id: string
  content: string
  createdAt: string | Date
  updatedAt: string | Date
  isStarred: boolean
  isAIBot: boolean
  messageId: string
  authorId: string | null
  parentId: string | null
  quotedMessageId: string | null
  author: {
    id: string
    name: string | null
    avatar: string | null
  } | null
  message: {
    id: string
    content: string
    author: {
      id: string
      name: string | null
      avatar: string | null
    }
  }
  parent: {
    id: string
    content: string
    author: {
      id: string
      name: string | null
      avatar: string | null
    }
  } | null
  tags: Array<{
    tag: {
      id: string
      name: string
      color: string | null
    }
  }>
  type: 'comment'
}

// 搜索结果中的消息类型
export interface MessageSearchResult extends MessageWithRelations {
  type: 'message'
}

// 搜索结果联合类型
export type SearchResultItem = MessageSearchResult | CommentWithRelations

export interface SearchResponse {
  data: SearchResultItem[]
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
    messageCount: number
    commentCount: number
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
  ragTimeFilterStart: Date | null
  ragTimeFilterEnd: Date | null
  ragflowBaseUrl: string
  ragflowApiKey: string
  autoTagModel: string
  briefingModel: string
  briefingTime: string
  aiPersonality: string
  aiExpertise: string | null
  enableLinkSuggestion: boolean
  enableMdSync: boolean
  mdSyncDir: string | null
  asrApiKey: string
  asrApiUrl: string
  updatedAt: string
}

export interface UpdateAIConfigInput {
  openaiBaseUrl?: string
  openaiApiKey?: string
  openaiModel?: string
  ragflowBaseUrl?: string
  ragflowApiKey?: string
  ragTimeFilterStart?: string
  ragTimeFilterEnd?: string
  autoTagModel?: string
  briefingModel?: string
  briefingTime?: string
  aiPersonality?: string
  aiExpertise?: string
  enableLinkSuggestion?: boolean
  enableMdSync?: boolean
  mdSyncDir?: string
  asrApiKey?: string
  asrApiUrl?: string
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
  mode?: 'goldierill' | 'ragflow'  // 新增：AI 调用模式
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

// ==================== AI Commands ====================
export interface AICommand {
  id: string
  label: string
  description: string
  action: string
  prompt: string
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
  authorId: string | null
}

export interface CreateAICommandInput {
  label: string
  description: string
  action: string
  prompt: string
}

export interface UpdateAICommandInput {
  label?: string
  description?: string
  prompt?: string
}

export interface AICommandsResponse {
  data: AICommand[]
  error?: string
}

export interface AICommandResponse {
  data?: AICommand
  error?: string
}

// ==================== Workspaces ====================
export interface Workspace {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  ragflowDatasetId: string | null
  ragflowChatId: string | null
  enableAutoTag: boolean
  enableBriefing: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateWorkspaceInput {
  name: string
  description?: string
}

export interface UpdateWorkspaceInput {
  name?: string
  description?: string
  enableAutoTag?: boolean
  enableBriefing?: boolean
}

export interface WorkspacesResponse {
  data: Workspace[]
  error?: string
}

export interface WorkspaceResponse {
  data?: Workspace
  error?: string
}
