"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageCard } from "@/components/MessageCard"
import { Message, messagesApi } from "@/lib/api/messages"
import { Loader2 } from "lucide-react"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import { Button } from "@/components/ui/button"

interface MessagesListProps {
  filters?: {
    tagId?: string
    isStarred?: boolean
    isPinned?: boolean
    rootOnly?: boolean
    workspaceId?: string
  }
  onMessagesLoaded?: () => void
}

const PAGE_SIZE = 20 // 每页加载数量

export function MessagesList({ filters, onMessagesLoaded }: MessagesListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const { currentWorkspaceId } = useWorkspaceStore()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // 用于追踪是否是初始加载
  const isInitialLoad = useRef(true)

  const fetchMessages = useCallback(async ({
    pageNum = 1,
    isLoadMore = false,
    showLoading = true,
  }: {
    pageNum?: number
    isLoadMore?: boolean
    showLoading?: boolean
  }) => {
    if (isLoadMore) {
      setIsLoadingMore(true)
    } else if (showLoading) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const result = await messagesApi.getMessages({
        ...filters,
        workspaceId: filters?.workspaceId || currentWorkspaceId || undefined,
        page: pageNum,
        limit: PAGE_SIZE,
      })

      if (result.error) {
        setError(result.error)
      } else {
        const newMessages = result.data || []
        const meta = result.meta
        
        if (isLoadMore) {
          // 追加数据
          setMessages((prev) => {
            // 去重：避免重复添加已存在的消息
            const existingIds = new Set(prev.map(m => m.id))
            const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id))
            return [...prev, ...uniqueNewMessages]
          })
        } else {
          // 替换数据
          setMessages(newMessages)
        }
        
        // 检查是否还有更多数据
        setHasMore(newMessages.length === PAGE_SIZE && 
          (!meta || pageNum < meta.totalPages))
        
        // Notify parent that messages are loaded
        if (onMessagesLoaded && !showLoading && !isLoadMore) {
          setTimeout(() => onMessagesLoaded(), 50)
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err)
      setError("Failed to load messages")
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [filters, currentWorkspaceId, onMessagesLoaded])

  // 初始加载和筛选条件变化时重置
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchMessages({ pageNum: 1, isLoadMore: false, showLoading: true })
    isInitialLoad.current = false
  }, [filters, currentWorkspaceId])

  // 加载更多
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMessages({ pageNum: nextPage, isLoadMore: true, showLoading: false })
  }, [page, isLoadingMore, hasMore, fetchMessages])

  // 使用 Intersection Observer 监听滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isInitialLoad.current) {
          loadMore()
        }
      },
      { 
        rootMargin: "100px", // 提前 100px 触发加载
        threshold: 0 
      }
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [loadMore, hasMore, isLoadingMore])

  // Refresh after 5 seconds when a new message is posted (for AI tags)
  useEffect(() => {
    const handleMessagePosted = () => {
      const timeoutId = setTimeout(() => {
        fetchMessages({ pageNum: 1, isLoadMore: false, showLoading: false })
      }, 5000)

      return () => clearTimeout(timeoutId)
    }

    window.addEventListener('message-posted', handleMessagePosted)
    return () => {
      window.removeEventListener('message-posted', handleMessagePosted)
    }
  }, [fetchMessages])

  // Refresh when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      fetchMessages({ pageNum: 1, isLoadMore: false, showLoading: false })
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchMessages])

  const handleMessageUpdate = () => {
    fetchMessages({ pageNum: 1, isLoadMore: false, showLoading: false })
  }

  const handleMessageDelete = (deletedId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== deletedId))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border-b">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                <div className="h-16 w-full bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Button 
          variant="outline" 
          onClick={() => fetchMessages({ pageNum: 1, isLoadMore: false, showLoading: true })}
          className="mt-4"
        >
          重试
        </Button>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-2">还没有消息</p>
        <p className="text-sm text-muted-foreground">
          发布你的第一条消息吧！
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          onUpdate={handleMessageUpdate}
          onDelete={handleMessageDelete}
        />
      ))}
      
      {/* 加载更多触发器 */}
      <div ref={loadMoreRef} className="py-4">
        {isLoadingMore && (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载更多...</span>
          </div>
        )}
        
        {!hasMore && messages.length > 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            已加载全部 {messages.length} 条消息
          </div>
        )}
        
        {hasMore && !isLoadingMore && (
          <div className="flex justify-center py-4">
            <Button 
              variant="ghost" 
              onClick={loadMore}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              点击加载更多
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
