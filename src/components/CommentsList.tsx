"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Bot,
  Image as ImageIcon,
  Smile,
  MessageCircle,
  Repeat2,
  Heart,
  BarChart2,
  Share,
} from "lucide-react"
import { commentsApi, aiApi } from "@/lib/api"
import { Comment } from "@/types/api"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useSession } from "next-auth/react"
import { TipTapViewer } from "@/components/TipTapViewer"

interface CommentsListProps {
  messageId: string
  onCommentAdded?: () => void
}

export function CommentsList({ messageId, onCommentAdded }: CommentsListProps) {
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [newComment, setNewComment] = useState("")
  const { data: session } = useSession()

  // Fetch comments (only top-level)
  const fetchComments = async () => {
    setLoading(true)
    try {
      const result = await commentsApi.getComments(messageId)
      if (result.data) {
        // 只显示顶级评论（parentId 为 null）
        const topLevelComments = result.data.filter(c => !c.parentId)
        setComments(topLevelComments)
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

        // Check if comment contains @goldierill and trigger AI reply
        if (newComment.includes('@goldierill')) {
          try {
            const question = newComment.replace('@goldierill', '').trim()
            const aiResult = await aiApi.chat({
              messageId,
              content: question || '请回复这条评论',
            })
            if (aiResult.data?.comment) {
              const aiComment = aiResult.data.comment
              setComments(prev => [...prev, aiComment])
              onCommentAdded?.()
            }
          } catch (aiError) {
            console.error("Failed to get AI reply:", aiError)
          }
        }

        setNewComment("")
        onCommentAdded?.()
      }
    } catch (error) {
      console.error("Failed to post comment:", error)
    } finally {
      setPosting(false)
    }
  }

  // Get user initials
  const getInitials = (name: string | null | undefined) => {
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

  // 获取评论的子评论数量
  const getReplyCount = (comment: Comment) => {
    return comment._count?.replies || 0
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Comment input - Twitter Style */}
      <div className="p-4 border-b">
        <div className="flex gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={session?.user?.image || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {getInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              placeholder="发布你的回复"
              className="w-full bg-transparent border-none focus:outline-none text-lg resize-none min-h-[40px] py-1 placeholder:text-muted-foreground"
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              disabled={posting}
              rows={1}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-1 text-primary">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary hover:bg-primary/10">
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary hover:bg-primary/10">
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="rounded-full px-5 font-bold h-9 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                disabled={!newComment.trim() || posting}
                onClick={handlePostComment}
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "回复"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments list - Flat (Top-level only) */}
      <div className="flex flex-col">
        {comments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            暂无评论，来说点什么吧
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 border-b hover:bg-muted/5 transition-colors cursor-pointer"
              onClick={() => router.push(`/status/${messageId}/comment/${comment.id}`)}
            >
              <div className="flex gap-3">
                {/* Avatar */}
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={comment.author?.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(comment.author?.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-bold text-sm hover:underline">
                      {comment.author?.name || "Anonymous"}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      @{comment.author?.email?.split('@')[0] || "user"}
                    </span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="text-muted-foreground text-sm hover:underline">
                      {formatTime(comment.createdAt)}
                    </span>
                    {comment.isAIBot && (
                      <Bot className="h-3.5 w-3.5 text-primary ml-1" />
                    )}
                  </div>
                  <div className="mt-1 text-[15px] leading-normal wrap-break-word">
                    <TipTapViewer content={comment.content} />
                  </div>

                  {/* Action row for comments */}
                  <div className="mt-3 flex items-center justify-between max-w-75 text-muted-foreground">
                    <div className="group flex items-center">
                      <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {getReplyCount(comment)}
                      </span>
                    </div>
                    <div className="group flex items-center cursor-pointer">
                      <div className="p-2 rounded-full group-hover:bg-green-500/10 group-hover:text-green-500 transition-colors">
                        <Repeat2 className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="group flex items-center cursor-pointer">
                      <div className="p-2 rounded-full group-hover:bg-pink-500/10 group-hover:text-pink-500 transition-colors">
                        <Heart className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="group flex items-center cursor-pointer">
                      <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                        <BarChart2 className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="group flex items-center cursor-pointer">
                      <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors text-right">
                        <Share className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
