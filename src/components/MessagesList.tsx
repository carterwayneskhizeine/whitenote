"use client"

import { useState, useEffect } from "react"
import { MessageCard } from "@/components/MessageCard"
import { Message, messagesApi } from "@/lib/api/messages"
import { Loader2 } from "lucide-react"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"

interface MessagesListProps {
  filters?: {
    tagId?: string
    isStarred?: boolean
    isPinned?: boolean
    rootOnly?: boolean
    workspaceId?: string // Add workspaceId to filters
  }
  onMessagesLoaded?: () => void
}

export function MessagesList({ filters, onMessagesLoaded }: MessagesListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { currentWorkspaceId } = useWorkspaceStore()

  const fetchMessages = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const result = await messagesApi.getMessages({
        ...filters,
        workspaceId: filters?.workspaceId || currentWorkspaceId || undefined, // Use current workspace ID
      })

      if (result.error) {
        setError(result.error)
      } else {
        const newMessages = result.data || []
        setMessages(newMessages)
        // Notify parent that messages are loaded (even if empty, for scrolling purposes)
        if (onMessagesLoaded && !showLoading) {
          // Only call on refresh (not initial load) to allow time for DOM to update
          setTimeout(() => onMessagesLoaded(), 50)
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err)
      setError("Failed to load messages")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [filters, currentWorkspaceId])

  // Refresh after 5 seconds when a new message is posted (for AI tags)
  useEffect(() => {
    const handleMessagePosted = () => {
      // Set a timeout to refresh after 5 seconds (giving AI time to generate tags)
      const timeoutId = setTimeout(() => {
        fetchMessages(false)
      }, 5000)

      return () => clearTimeout(timeoutId)
    }

    // Listen for custom event when a message is posted
    window.addEventListener('message-posted', handleMessagePosted)
    return () => {
      window.removeEventListener('message-posted', handleMessagePosted)
    }
  }, [filters, currentWorkspaceId])

  // Refresh when window gains focus (e.g., returning from detail page)
  useEffect(() => {
    const handleFocus = () => {
      fetchMessages(false)
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [filters, currentWorkspaceId])

  const handleMessageUpdate = () => {
    // Refresh messages when a message is updated
    fetchMessages(false)
  }

  const handleMessageDelete = (deletedId: string) => {
    // Remove deleted message from state
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
    </div>
  )
}
