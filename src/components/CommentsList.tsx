"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import {
  Loader2,
  Bot,
  MessageCircle,
  Repeat2,
  Share,
  Edit2,
  Trash2,
  MoreVertical,
  Copy,
  Bookmark,
  BookmarkCheck,
} from "lucide-react"
import { commentsApi, aiApi, templatesApi } from "@/lib/api"
import { Comment } from "@/types/api"
import { Template } from "@/types/api"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useSession } from "next-auth/react"
import { TipTapViewer } from "@/components/TipTapViewer"
import { ReplyDialog } from "@/components/ReplyDialog"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { RetweetDialog } from "@/components/RetweetDialog"
import { cn, getHandle } from "@/lib/utils"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { ImageLightbox } from "@/components/ImageLightbox"
import { MediaGrid } from "@/components/MediaGrid"

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
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const mediaUploaderRef = useRef<MediaUploaderRef>(null)
  const { data: session } = useSession()

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

  // Handle retweet - opens quote retweet dialog
  const handleRetweet = (comment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    setRetweetTarget(comment)
    setShowRetweetDialog(true)
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
        onCommentAdded?.()
      }
    } catch (error) {
      console.error("Failed to post comment:", error)
    } finally {
      setPosting(false)
    }
  }

  // Apply template
  const applyTemplate = (template: Template) => {
    setNewComment(prev => prev + template.content)
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
              {session?.user?.name?.slice(0, 2) || "U"}
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
            <MediaUploader
              ref={mediaUploaderRef}
              media={uploadedMedia}
              onMediaChange={setUploadedMedia}
              disabled={posting}
              onUploadingChange={setIsUploading}
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              {/* Left side: Action buttons */}
              <div className="flex-1 flex gap-1 text-primary">
                {/* Image Upload Button */}
                <button
                  className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full flex items-center justify-center disabled:opacity-50"
                  onClick={() => mediaUploaderRef.current?.triggerUpload()}
                  disabled={isUploading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </button>

                {/* Templates Dropdown */}
                {templates.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="8" y1="6" x2="21" y2="6"></line>
                          <line x1="8" y1="12" x2="21" y2="12"></line>
                          <line x1="8" y1="18" x2="21" y2="18"></line>
                          <line x1="3" y1="6" x2="3.01" y2="6"></line>
                          <line x1="3" y1="12" x2="3.01" y2="12"></line>
                          <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {templates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{template.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Right side: Submit button */}
              <Button
                className="rounded-full px-5 font-bold h-9 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                disabled={(!newComment.trim() && uploadedMedia.length === 0) || posting}
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
                <GoldieAvatar
                  name={comment.author?.name || null}
                  avatar={comment.author?.avatar || null}
                  size="lg"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-sm hover:underline">
                        {comment.author?.name || "GoldieRill"}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        @{getHandle(comment.author?.email || null, !!comment.author)}
                      </span>
                      <span className="text-muted-foreground text-sm">·</span>
                      <span className="text-muted-foreground text-sm hover:underline">
                        {formatTime(comment.createdAt)}
                      </span>
                      {comment.isAIBot && (
                        <Bot className="h-3.5 w-3.5 text-primary ml-1" />
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/status/${messageId}/comment/${comment.id}/edit`)
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteClick(comment, e)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-1 text-sm leading-normal wrap-break-word">
                    <TipTapViewer content={comment.content} />
                  </div>

                  {/* Media Display */}
                  <MediaGrid
                    medias={comment.medias || []}
                    onImageClick={(index, e) => {
                      e.stopPropagation()
                      handleImageClick(index, comment.medias, e)
                    }}
                    className="mt-2"
                  />

                  {/* 引用的消息卡片 - 类似 X/Twitter */}
                  {comment.quotedMessage && (
                    <QuotedMessageCard
                      message={comment.quotedMessage}
                      className="mt-2"
                    />
                  )}

                  {/* Action row for comments */}
                  <div className="mt-3 flex items-center justify-between gap-2 text-muted-foreground">
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        setReplyTarget(comment)
                        setShowReplyDialog(true)
                      }}
                    >
                      <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {getReplyCount(comment)}
                      </span>
                    </div>
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={(e) => handleCopy(comment, e)}
                    >
                      <div className={cn(
                        "p-2 rounded-full transition-colors",
                        copiedId === comment.id ? "bg-green-500/20" : "group-hover:bg-green-500/10"
                      )}>
                        <Copy className={cn(
                          "h-4 w-4 transition-colors",
                          copiedId === comment.id ? "text-green-500" : "text-muted-foreground group-hover:text-green-500"
                        )} />
                      </div>
                    </div>
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={(e) => handleRetweet(comment, e)}
                    >
                      <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                        <Repeat2 className="h-4 w-4 transition-colors text-muted-foreground group-hover:text-green-500" />
                      </div>
                      {(comment.retweetCount ?? 0) > 0 && (
                        <span className="ml-1 text-xs text-foreground/60 group-hover:text-green-600 transition-colors">
                          {comment.retweetCount}
                        </span>
                      )}
                    </div>
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={(e) => handleToggleStar(comment, e)}
                    >
                      <div className="p-2 rounded-full group-hover:bg-yellow-500/10 transition-colors">
                        {starredComments.has(comment.id) ? (
                          <BookmarkCheck className="h-4 w-4 text-yellow-600 fill-yellow-600 transition-colors" />
                        ) : (
                          <Bookmark className="h-4 w-4 text-muted-foreground group-hover:text-yellow-600 transition-colors" />
                        )}
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
