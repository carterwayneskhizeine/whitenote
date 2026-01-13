"use client"

import { MessagesList } from "@/components/MessagesList"
import { useMemo, useState, useEffect } from "react"
import { commentsApi } from "@/lib/api"
import { Comment } from "@/types/api"
import { Loader2 } from "lucide-react"
import { CommentItem } from "@/components/CommentItem"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"

export default function FavoritesPage() {
  const router = useRouter()
  // Use useMemo to prevent infinite re-renders
  const filters = useMemo(() => ({ isStarred: true, rootOnly: false }), [])
  const [starredComments, setStarredComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  // Reply dialog state
  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)

  // Retweet dialog state
  const [showRetweetDialog, setShowRetweetDialog] = useState(false)
  const [retweetTarget, setRetweetTarget] = useState<Comment | null>(null)

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Manage starred state for each comment
  const [starredSet, setStarredSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchStarredComments = async () => {
      setLoadingComments(true)
      try {
        const result = await commentsApi.getStarredComments()
        if (result.data) {
          setStarredComments(result.data)
          // Initialize starred state (all are starred since they come from starred API)
          const starred = new Set<string>()
          result.data.forEach(c => {
            if (c.isStarred) starred.add(c.id)
          })
          setStarredSet(starred)
        }
      } catch (error) {
        console.error("Failed to fetch starred comments:", error)
      } finally {
        setLoadingComments(false)
      }
    }

    fetchStarredComments()
  }, [])

  // Handle delete comment
  const handleDeleteClick = (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    setCommentToDelete(comment)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!commentToDelete) return
    setDeletingCommentId(commentToDelete.id)
    try {
      const result = await commentsApi.deleteComment(commentToDelete.id)
      if (result.success) {
        setStarredComments(starredComments.filter(c => c.id !== commentToDelete.id))
      }
    } catch (error) {
      console.error("Failed to delete comment:", error)
    } finally {
      setDeletingCommentId(null)
      setShowDeleteDialog(false)
      setCommentToDelete(null)
    }
  }

  // Handle reply
  const handleReply = (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    setReplyTarget(comment)
    setShowReplyDialog(true)
  }

  // Handle copy
  const handleCopy = async (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(comment.content)
      setCopiedId(comment.id)
      setTimeout(() => setCopiedId(null), 1000)
    } catch (error) {
      console.error("Failed to copy comment:", error)
    }
  }

  // Handle retweet
  const handleRetweet = (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    setRetweetTarget(comment)
    setShowRetweetDialog(true)
  }

  // Handle toggle star
  const handleToggleStar = async (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await commentsApi.toggleStar(comment.id)
      if (result.data) {
        const { isStarred } = result.data
        setStarredSet(prev => {
          const newSet = new Set(prev)
          if (isStarred) {
            newSet.add(comment.id)
          } else {
            newSet.delete(comment.id)
          }
          return newSet
        })
        // If unstarred, remove from list
        if (!isStarred) {
          setStarredComments(starredComments.filter(c => c.id !== comment.id))
        }
      }
    } catch (error) {
      console.error("Failed to toggle star:", error)
    }
  }

  // Get reply count
  const getReplyCount = (comment: Comment) => {
    return comment._count?.replies || 0
  }

  return (
    <>
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b p-4">
        <h1 className="text-xl font-bold">收藏</h1>
      </div>

      {/* Starred Messages */}
      <MessagesList filters={filters} />

      {/* Starred Comments Section */}
      <div className="border-t">
        {loadingComments ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : starredComments.length > 0 ? (
          <div>
            {starredComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onClick={() => router.push(`/status/${comment.messageId}/comment/${comment.id}`)}
                onEditClick={(e) => {
                  e.stopPropagation()
                  router.push(`/status/${comment.messageId}/comment/${comment.id}/edit`)
                }}
                onDeleteClick={(e) => handleDeleteClick(comment, e)}
                replyCount={getReplyCount(comment)}
                onReply={(e) => handleReply(comment, e)}
                copied={copiedId === comment.id}
                onCopy={(e) => handleCopy(comment, e)}
                retweetCount={comment.retweetCount ?? 0}
                onRetweet={(e) => handleRetweet(comment, e)}
                starred={starredSet.has(comment.id)}
                onToggleStar={(e) => handleToggleStar(comment, e)}
                size="md"
                actionRowSize="sm"
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Reply Dialog */}
      <ReplyDialog
        open={showReplyDialog}
        onOpenChange={setShowReplyDialog}
        target={replyTarget}
        messageId={replyTarget?.messageId || ""}
        onSuccess={() => {
          // Reply was successful, dialog will close automatically
          setShowReplyDialog(false)
        }}
      />

      {/* Retweet Dialog */}
      <RetweetDialog
        open={showRetweetDialog}
        onOpenChange={setShowRetweetDialog}
        target={retweetTarget}
        targetType="comment"
        onSuccess={() => {
          // Navigate to home to show the new message
          router.push('/')
        }}
      />

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除评论</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条评论吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingCommentId !== null}
            >
              {deletingCommentId ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
