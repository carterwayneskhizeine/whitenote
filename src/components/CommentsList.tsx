"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { commentsApi, aiApi, templatesApi } from "@/lib/api"
import { Comment } from "@/types/api"
import { Template } from "@/types/api"
import { MediaItem } from "@/components/MediaUploader"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"
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
import { ImageLightbox } from "@/components/ImageLightbox"
import { CompactReplyInput } from "@/components/CompactReplyInput"
import { CommentItem } from "@/components/CommentItem"
import { useMobile } from "@/hooks/use-mobile"

interface CommentsListProps {
  messageId: string
  onCommentAdded?: () => void
}

export function CommentsList({ messageId, onCommentAdded }: CommentsListProps) {
  const isMobile = useMobile()
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [replyInputFocused, setReplyInputFocused] = useState(false)

  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)
  const [showRetweetDialog, setShowRetweetDialog] = useState(false)
  const [retweetTarget, setRetweetTarget] = useState<Comment | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Manage starred state for each comment
  const [starredComments, setStarredComments] = useState<Set<string>>(new Set())

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [currentMedias, setCurrentMedias] = useState<Comment['medias']>([])

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const result = await templatesApi.getTemplates()
        if (result.data) {
          setTemplates(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error)
      }
    }
    fetchTemplates()
  }, [])

  // Fetch comments (only top-level)
  const fetchComments = async () => {
    setLoading(true)
    try {
      const result = await commentsApi.getComments(messageId)
      if (result.data) {
        // 只显示顶级评论（parentId 为 null）
        const topLevelComments = result.data.filter(c => !c.parentId)
        setComments(topLevelComments)

        // Initialize starred state
        const starred = new Set<string>()
        topLevelComments.forEach(c => {
          if (c.isStarred) starred.add(c.id)
        })
        setStarredComments(starred)
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

  // Handle retweet - opens quote retweet dialog on desktop, navigates on mobile
  const handleRetweet = (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMobile) {
      router.push(`/retweet?id=${comment.id}&type=comment&messageId=${messageId}`)
    } else {
      setRetweetTarget(comment)
      setShowRetweetDialog(true)
    }
  }

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
        setComments(comments.filter(c => c.id !== commentToDelete.id))
        onCommentAdded?.()
      }
    } catch (error) {
      console.error("Failed to delete comment:", error)
    } finally {
      setDeletingCommentId(null)
      setShowDeleteDialog(false)
      setCommentToDelete(null)
    }
  }

  // Handle copy comment
  const handleCopy = async (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      // Copy the raw Markdown content directly (preserves code blocks and formatting)
      await navigator.clipboard.writeText(comment.content)
      setCopiedId(comment.id)
      setTimeout(() => setCopiedId(null), 1000)
    } catch (error) {
      console.error("Failed to copy comment:", error)
    }
  }

  // Handle toggle star
  const handleToggleStar = async (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await commentsApi.toggleStar(comment.id)
      if (result.data) {
        const { isStarred } = result.data
        setStarredComments(prev => {
          const newSet = new Set(prev)
          if (isStarred) {
            newSet.add(comment.id)
          } else {
            newSet.delete(comment.id)
          }
          return newSet
        })
      }
    } catch (error) {
      console.error("Failed to toggle star:", error)
    }
  }

  // Handle image click to open lightbox
  const handleImageClick = (index: number, medias: Comment['medias'], e: React.MouseEvent) => {
    e.stopPropagation()
    if (!medias || medias.length === 0) return
    setCurrentMedias(medias)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // Post new comment
  const handlePostComment = async () => {
    if ((!newComment.trim() && uploadedMedia.length === 0) || posting) return

    setPosting(true)
    try {
      const result = await commentsApi.createComment({
        content: newComment.trim(),
        messageId,
        media: uploadedMedia.map(m => ({ url: m.url, type: m.type })),
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
        setUploadedMedia([])
        setReplyInputFocused(false)
        onCommentAdded?.()
      }
    } catch (error) {
      console.error("Failed to post comment:", error)
    } finally {
      setPosting(false)
    }
  }

  // Handle AI command selection from button
  const handleAICommandFromButton = async (action: string) => {
    setIsProcessingAI(true)
    try {
      const response = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          content: newComment.trim(),
        }),
      })

      if (!response.ok) throw new Error('AI request failed')

      const data = await response.json()
      if (data.data?.result) {
        const result = data.data.result.trim()
        setNewComment(result)
      }
    } catch (error) {
      console.error('AI enhance error:', error)
    } finally {
      setIsProcessingAI(false)
    }
  }

  // Handle template selection from "/" command
  const handleTemplateSelect = (template: Template, editor: any) => {
    if (!editor) return
    const currentContent = editor.getMarkdown()
    const newContent = currentContent + (currentContent ? "\n" : "") + template.content
    editor.commands.setContent(newContent, {
      contentType: 'markdown',
      parseOptions: {
        preserveWhitespace: 'full',
      },
    })
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
      <CompactReplyInput
        value={newComment}
        onChange={setNewComment}
        media={uploadedMedia}
        onMediaChange={setUploadedMedia}
        isUploading={isUploading}
        onUploadingChange={setIsUploading}
        posting={posting}
        focused={replyInputFocused}
        onFocusedChange={setReplyInputFocused}
        templates={templates}
        onAICommandSelect={handleAICommandFromButton}
        onSubmit={handlePostComment}
      />

      {/* Comments list - Flat (Top-level only) */}
      <div className="flex flex-col">
        {comments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            暂无评论，来说点什么吧
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onClick={() => router.push(`/status/${messageId}/comment/${comment.id}`)}
              onEditClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                router.push(`/status/${messageId}/comment/${comment.id}/edit`)
              }}
              onDeleteClick={(e) => handleDeleteClick(comment, e)}
              replyCount={getReplyCount(comment)}
              onReply={(e) => {
                e.stopPropagation()
                if (isMobile) {
                  router.push(`/status/${messageId}/comment/${comment.id}/reply`)
                } else {
                  setReplyTarget(comment)
                  setShowReplyDialog(true)
                }
              }}
              copied={copiedId === comment.id}
              onCopy={(e) => handleCopy(comment, e)}
              retweetCount={comment.retweetCount ?? 0}
              onRetweet={(e) => handleRetweet(comment, e)}
              starred={starredComments.has(comment.id)}
              onToggleStar={(e) => handleToggleStar(comment, e)}
              onImageClick={(index, e) => handleImageClick(index, comment.medias, e)}
              size="md"
              actionRowSize="sm"
            />
          ))
        )}
      </div>

      {/* Reply Dialog */}
      <ReplyDialog
        open={showReplyDialog}
        onOpenChange={setShowReplyDialog}
        target={replyTarget}
        messageId={messageId}
        onSuccess={() => {
          // Refresh comments list
          fetchComments()
          onCommentAdded?.()
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

      {/* Image Lightbox */}
      <ImageLightbox
        media={currentMedias || []}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  )
}
