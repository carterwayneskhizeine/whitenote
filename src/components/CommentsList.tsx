"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Bot } from "lucide-react"
import { commentsApi, aiApi } from "@/lib/api"
import { Comment } from "@/types/api"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

interface CommentsListProps {
  messageId: string
  onCommentAdded?: () => void
}

export function CommentsList({ messageId, onCommentAdded }: CommentsListProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [aiChatting, setAiChatting] = useState(false)
  const [newComment, setNewComment] = useState("")

  // Fetch comments
  const fetchComments = async () => {
    setLoading(true)
    try {
      const result = await commentsApi.getComments(messageId)
      if (result.data) {
        setComments(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComments()
  }, [messageId])

  // Post new comment
  const handlePostComment = async () => {
    if (!newComment.trim() || posting) return

    setPosting(true)
    try {
      const result = await commentsApi.createComment({
        content: newComment.trim(),
        messageId,
      })

      if (result.data) {
        setComments([...comments, result.data])
        setNewComment("")
        onCommentAdded?.()
      }
    } catch (error) {
      console.error("Failed to post comment:", error)
    } finally {
      setPosting(false)
    }
  }

  // AI chat
  const handleAIChat = async () => {
    if (!newComment.trim() || aiChatting) return

    setAiChatting(true)
    try {
      const result = await aiApi.chat({
        messageId,
        content: newComment.trim(),
      })

      if (result.data?.comment) {
        setComments([...comments, result.data.comment])
        setNewComment("")
        onCommentAdded?.()
      }
    } catch (error) {
      console.error("Failed to chat with AI:", error)
    } finally {
      setAiChatting(false)
    }
  }

  // Get user initials
  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Format time
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN,
      })
    } catch {
      return ""
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="border-t">
      {/* Comments list */}
      <div className="max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            暂无评论，来说点什么吧
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="p-4 border-b last:border-b-0">
              <div className="flex gap-3">
                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={comment.author?.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(comment.author?.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">
                      {comment.author?.name || "Anonymous"}
                    </span>
                    {comment.isAIBot && (
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="text-muted-foreground text-xs">
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                  <div
                    className="mt-1 text-sm whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="写评论... 点击 🤖 按钮让 AI 回复"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handlePostComment()
              }
            }}
            disabled={posting || aiChatting}
            className="flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0"
            disabled={!newComment.trim() || posting || aiChatting}
            onClick={handlePostComment}
            title="发送评论"
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 text-primary"
            disabled={!newComment.trim() || posting || aiChatting}
            onClick={handleAIChat}
            title="AI 回复"
          >
            {aiChatting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          💡 提示：按 Enter 发送评论，点击 🤖 按钮让 AI 回复
        </div>
      </div>
    </div>
  )
}
