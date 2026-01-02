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
