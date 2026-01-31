"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { CommentItem } from "@/components/CommentItem"

interface PublicCommentsListProps {
  messageId: string
}

export function PublicCommentsList({ messageId }: PublicCommentsListProps) {
  const router = useRouter()
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/public/messages/${messageId}/comments`)
        if (response.ok) {
          const result = await response.json()
          setComments(result.data)
        } else {
          setError("加载评论失败")
        }
      } catch (err) {
        console.error("Failed to load comments:", err)
        setError("加载评论失败")
      } finally {
        setLoading(false)
      }
    }
    fetchComments()
  }, [messageId])

  const handleCopy = async (comment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(comment.content)
      setCopiedId(comment.id)
      setTimeout(() => setCopiedId(null), 1000)
    } catch (error) {
      console.error("Failed to copy comment:", error)
    }
  }

  const handleShare = (commentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/share/comment/${commentId}`)
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        {error}
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        暂无评论
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border font-bold">
        评论 ({comments.length})
      </div>

      {/* Comments List */}
      <div className="flex flex-col">
        {comments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onClick={() => router.push(`/share/comment/${comment.id}`)}
            showMenu={false}
            onReply={undefined}
            onRetweet={undefined}
            onToggleStar={undefined}
            copied={copiedId === comment.id}
            onCopy={(e) => handleCopy(comment, e)}
            onShare={(e) => handleShare(comment.id, e)}
            replyCount={comment._count?.replies || 0}
            retweetCount={comment.retweetCount ?? 0}
            size="md"
            actionRowSize="sm"
          />
        ))}
      </div>
    </div>
  )
}
