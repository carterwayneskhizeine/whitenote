"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { commentsApi, aiApi, templatesApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { MessageCircle, Repeat2, Share, Bot, Loader2, Edit2, Trash2, MoreVertical, Copy, Bookmark, BookmarkCheck } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { TipTapViewer } from "@/components/TipTapViewer"
import { CommentBreadcrumb } from "@/components/CommentBreadcrumb"
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
import { Comment } from "@/types/api"
import { Template } from "@/types/api"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { cn, getHandle } from "@/lib/utils"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { ImageLightbox } from "@/components/ImageLightbox"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { MediaGrid } from "@/components/MediaGrid"

export default function CommentDetailPage() {
  const { id, commentId } = useParams() as { id: string; commentId: string }
  const router = useRouter()
  const { data: session } = useSession()

  const [comment, setComment] = useState<Comment | null>(null)
  const [childComments, setChildComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)
  const [newReply, setNewReply] = useState("")
  const [posting, setPosting] = useState(false)
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const mediaUploaderRef = useRef<MediaUploaderRef>(null)

  const [showRetweetDialog, setShowRetweetDialog] = useState(false)
  const [retweetTarget, setRetweetTarget] = useState<Comment | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [currentMedias, setCurrentMedias] = useState<Comment['medias']>([])

  // Manage starred state for comments
  const [starredComments, setStarredComments] = useState<Set<string>>(new Set())

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // 并行获取数据
        const [commentResult, childrenResult] = await Promise.all([
          commentsApi.getComment(commentId),
          commentsApi.getChildComments(commentId),
        ])

        if (commentResult.data) {
          setComment(commentResult.data)
        } else {
          setError(commentResult.error || "Comment not found")
        }

        if (childrenResult.data) {
          setChildComments(childrenResult.data)

          // Initialize starred state for all comments
          const starred = new Set<string>()
          if (commentResult.data?.isStarred) {
            starred.add(commentResult.data.id)
          }
          childrenResult.data.forEach(c => {
            if (c.isStarred) starred.add(c.id)
          })
          setStarredComments(starred)
        }
      } catch (err) {
        console.error("Failed to fetch comment data:", err)
        setError("Failed to load comment")
      } finally {
        setIsLoading(false)
      }
    }

    if (commentId) {
      fetchData()
    }
  }, [commentId, refreshKey])

  const handlePostReply = async () => {
    if ((!newReply.trim() && uploadedMedia.length === 0) || posting) return

    setPosting(true)
    try {
      const result = await commentsApi.createComment({
        content: newReply.trim(),
        messageId: id,
        parentId: commentId,
        media: uploadedMedia.map(m => ({ url: m.url, type: m.type })),
      })

      if (result.data) {
        setChildComments([...childComments, result.data])

        // Check if comment contains @goldierill and trigger AI reply
        if (newReply.includes('@goldierill')) {
          try {
            const question = newReply.replace('@goldierill', '').trim()
            const aiResult = await aiApi.chat({
              messageId: id,
              content: question || '请回复这条评论',
            })
            if (aiResult.data?.comment) {
              const aiComment = aiResult.data.comment
              setChildComments(prev => [...prev, aiComment])
            }
          } catch (aiError) {
            console.error("Failed to get AI reply:", aiError)
          }
        }

        setNewReply("")
        setUploadedMedia([])
      }
    } catch (error) {
      console.error("Failed to post reply:", error)
    } finally {
      setPosting(false)
    }
  }

  // Apply template
  const applyTemplate = (template: Template) => {
    setNewReply(prev => prev + template.content)
  }

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

  // Handle retweet - opens quote retweet dialog
  const handleRetweet = () => {
    if (!comment) return
    setRetweetTarget(comment)
    setShowRetweetDialog(true)
  }

  const handleDelete = async () => {
    if (!comment) return
    setIsDeleting(true)
    try {
      const result = await commentsApi.deleteComment(comment.id)
      if (result.success) {
        // Navigate back to the parent comment or message
        if (comment.parentId) {
          router.push(`/status/${id}/comment/${comment.parentId}`)
        } else {
          router.push(`/status/${id}`)
        }
      }
    } catch (error) {
      console.error("Failed to delete comment:", error)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Handle retweet for child comments
  const handleChildRetweet = (childComment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    setRetweetTarget(childComment)
    setShowRetweetDialog(true)
  }

  // Handle copy comment
  const handleCopy = async (commentId: string, content: string) => {
    try {
      // Copy the raw Markdown content directly (preserves code blocks and formatting)
      await navigator.clipboard.writeText(content)
      setCopiedId(commentId)
      setTimeout(() => setCopiedId(null), 1000)
    } catch (error) {
      console.error("Failed to copy comment:", error)
    }
  }

  // Handle toggle star
  const handleToggleStar = async (commentId: string) => {
    try {
      const result = await commentsApi.toggleStar(commentId)
      if (result.data) {
        const { isStarred } = result.data
        setStarredComments(prev => {
          const newSet = new Set(prev)
          if (isStarred) {
            newSet.add(commentId)
          } else {
            newSet.delete(commentId)
          }
          return newSet
        })
      }
    } catch (error) {
      console.error("Failed to toggle star:", error)
    }
  }

  const handleImageClick = (index: number, medias: Comment['medias'], e: React.MouseEvent) => {
    e.stopPropagation()
    if (!medias || medias.length === 0) return
    setCurrentMedias(medias)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !comment) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">{error || "Comment not found"}</p>
        <Button onClick={() => router.back()}>返回</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with Breadcrumb */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <CommentBreadcrumb
          messageId={id}
          parentId={comment.parentId}
          onNavigateBack={(targetId) => {
            // 检查是否是主消息ID
            if (targetId === id) {
              router.push(`/status/${id}`)
            } else {
              router.push(`/status/${id}/comment/${targetId}`)
            }
          }}
        />
      </div>

      {/* Comment Content */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <GoldieAvatar
            name={comment.author?.name || null}
            avatar={comment.author?.avatar || null}
            size="xl"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-base hover:underline">
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
                  <Bot className="h-4 w-4 text-primary ml-1" />
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => router.push(`/status/${id}/comment/${comment.id}/edit`)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-2 text-sm leading-normal wrap-break-word">
              <TipTapViewer content={comment.content} />
            </div>

            {/* Media Display */}
            <MediaGrid
              medias={comment.medias || []}
              onImageClick={(index, e) => handleImageClick(index, comment.medias, e)}
              className="mt-2"
            />

            {/* 引用的消息卡片 - 类似 X/Twitter */}
            {comment.quotedMessage && (
              <QuotedMessageCard
                message={comment.quotedMessage}
                className="mt-2"
              />
            )}

            {/* Action Row */}
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
                <span className="ml-1 text-sm">{childComments.length}</span>
              </div>
              <div
                className="group flex items-center cursor-pointer"
                onClick={() => handleCopy(comment.id, comment.content)}
              >
                <div className={cn(
                  "p-2 rounded-full transition-colors",
                  copiedId === comment.id ? "bg-green-500/20" : "group-hover:bg-green-500/10"
                )}>
                  <Copy className={cn(
                    "h-4 w-4 transition-colors",
                    copiedId === comment.id ? "text-green-500" : "group-hover:text-green-500"
                  )} />
                </div>
              </div>
              <div
                className="group flex items-center cursor-pointer"
                onClick={handleRetweet}
              >
                <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                  <Repeat2 className="h-4 w-4 transition-colors group-hover:text-green-500" />
                </div>
                {(comment?.retweetCount ?? 0) > 0 && (
                  <span className="ml-1 text-sm text-foreground/60 group-hover:text-green-600 transition-colors">
                    {comment.retweetCount}
                  </span>
                )}
              </div>
              <div
                className="group flex items-center cursor-pointer"
                onClick={() => handleToggleStar(comment.id)}
              >
                <div className="p-2 rounded-full group-hover:bg-yellow-500/10 transition-colors">
                  {starredComments.has(comment.id) ? (
                    <BookmarkCheck className="h-4 w-4 text-yellow-600 fill-yellow-600 transition-colors" />
                  ) : (
                    <Bookmark className="h-4 w-4 group-hover:text-yellow-600 transition-colors" />
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

      {/* Reply Input */}
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
              value={newReply}
              onChange={(e) => {
                setNewReply(e.target.value)
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
                disabled={(!newReply.trim() && uploadedMedia.length === 0) || posting}
                onClick={handlePostReply}
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

      {/* Child Comments List */}
      <div className="border-t">
        {childComments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            暂无回复，来说点什么吧
          </div>
        ) : (
          childComments.map((childComment) => (
            <div
              key={childComment.id}
              className="p-4 border-b hover:bg-muted/5 transition-colors cursor-pointer"
              onClick={() => router.push(`/status/${id}/comment/${childComment.id}`)}
            >
              <div className="flex gap-3">
                <GoldieAvatar
                  name={childComment.author?.name || null}
                  avatar={childComment.author?.avatar || null}
                  size="lg"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-sm hover:underline">
                        {childComment.author?.name || "GoldieRill"}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        @{getHandle(childComment.author?.email || null, !!childComment.author)}
                      </span>
                      <span className="text-muted-foreground text-sm">·</span>
                      <span className="text-muted-foreground text-sm hover:underline">
                        {formatTime(childComment.createdAt)}
                      </span>
                      {childComment.isAIBot && (
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
                            router.push(`/status/${id}/comment/${childComment.id}/edit`)
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteDialog(true)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-1 text-sm leading-normal wrap-break-word">
                    <TipTapViewer content={childComment.content} />
                  </div>

                  {/* Media Display */}
                  <MediaGrid
                    medias={childComment.medias || []}
                    onImageClick={(index, e) => handleImageClick(index, childComment.medias, e)}
                    className="mt-2"
                  />

                  {/* 引用的消息卡片 - 类似 X/Twitter */}
                  {childComment.quotedMessage && (
                    <QuotedMessageCard
                      message={childComment.quotedMessage}
                      className="mt-2"
                    />
                  )}

                  {/* Action Row for Child Comments */}
                  <div className="mt-3 flex items-center justify-between gap-2 text-muted-foreground">
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        setReplyTarget(childComment)
                        setShowReplyDialog(true)
                      }}
                    >
                      <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {childComment._count?.replies || 0}
                      </span>
                    </div>
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={() => handleCopy(childComment.id, childComment.content)}
                    >
                      <div className={cn(
                        "p-2 rounded-full transition-colors",
                        copiedId === childComment.id ? "bg-green-500/20" : "group-hover:bg-green-500/10"
                      )}>
                        <Copy className={cn(
                          "h-4 w-4 transition-colors",
                          copiedId === childComment.id ? "text-green-500" : "group-hover:text-green-500"
                        )} />
                      </div>
                    </div>
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={(e) => handleChildRetweet(childComment, e)}
                    >
                      <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                        <Repeat2 className="h-4 w-4 transition-colors group-hover:text-green-500" />
                      </div>
                      {(childComment.retweetCount ?? 0) > 0 && (
                        <span className="ml-1 text-xs text-foreground/60 group-hover:text-green-600 transition-colors">
                          {childComment.retweetCount}
                        </span>
                      )}
                    </div>
                    <div
                      className="group flex items-center cursor-pointer"
                      onClick={() => handleToggleStar(childComment.id)}
                    >
                      <div className="p-2 rounded-full group-hover:bg-yellow-500/10 transition-colors">
                        {starredComments.has(childComment.id) ? (
                          <BookmarkCheck className="h-4 w-4 text-yellow-600 fill-yellow-600 transition-colors" />
                        ) : (
                          <Bookmark className="h-4 w-4 group-hover:text-yellow-600 transition-colors" />
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
        target={replyTarget || comment}
        messageId={id}
        onSuccess={() => {
          // Refresh comment data to update reply count
          setRefreshKey(prev => prev + 1)
        }}
      />

      {/* Retweet Dialog */}
      <RetweetDialog
        open={showRetweetDialog}
        onOpenChange={setShowRetweetDialog}
        target={retweetTarget || comment}
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
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "删除"}
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
