"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { commentsApi, aiApi, templatesApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Bot, Loader2, Edit2, Trash2, MoreVertical } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { TipTapViewer } from "@/components/TipTapViewer"
import { CommentBreadcrumb } from "@/components/CommentBreadcrumb"
import { Separator } from "@/components/ui/separator"
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
import { MediaItem } from "@/components/MediaUploader"
import { getHandle, cn } from "@/lib/utils"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { ImageLightbox } from "@/components/ImageLightbox"
import { MediaGrid } from "@/components/MediaGrid"
import { ActionRow } from "@/components/ActionRow"
import { CompactReplyInput } from "@/components/CompactReplyInput"
import { CommentItem } from "@/components/CommentItem"
import { useMobile } from "@/hooks/use-mobile"
import { ShareDialog } from "@/components/ShareDialog"
import { useShare } from "@/hooks/useShare"

export default function CommentDetailPage() {
  const { id, commentId } = useParams() as { id: string; commentId: string }
  const router = useRouter()
  const isMobile = useMobile()

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
  const [replyInputFocused, setReplyInputFocused] = useState(false)
  const [isProcessingAI, setIsProcessingAI] = useState(false)

  const [showRetweetDialog, setShowRetweetDialog] = useState(false)
  const [retweetTarget, setRetweetTarget] = useState<Comment | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { showShareDialog, setShowShareDialog, handleShare, shareItemId } = useShare()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [markdownImages, setMarkdownImages] = useState<string[]>([])
  const [currentMedias, setCurrentMedias] = useState<Comment['medias']>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasMore, setHasMore] = useState(false)

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
          // 过滤掉自引用的评论（parentId 指向自己的评论）
          const filteredChildren = childrenResult.data.filter(c => c.id !== commentId)
          setChildComments(filteredChildren)

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

  // Extract markdown images from content
  useEffect(() => {
    if (comment?.content) {
      // 使用 Set 去重，确保相同的 URL 只出现一次
      const images = Array.from(new Set(
        comment.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
          const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
          return url || ''
        }).filter(url => url && !url.startsWith('data:')) || []
      ))
      setMarkdownImages(images)
    }
  }, [comment?.content])

  // 检测内容是否需要"显示更多"按钮
  useEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current) {
        const el = contentRef.current
        // 当应用 line-clamp 后，如果 scrollHeight > clientHeight 说明内容被裁剪了
        setHasMore(el.scrollHeight > el.clientHeight)
      }
    }

    // 多次检测以确保 TipTapViewer 内容完全渲染
    const timer1 = setTimeout(checkOverflow, 100)
    const timer2 = setTimeout(checkOverflow, 300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [comment?.content])

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
        setReplyInputFocused(false)
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

  // Sanitize markdown to prevent TipTap mark conflicts
  const sanitizeMarkdown = (markdown: string): string => {
    // Remove bold from within code blocks (e.g., **`code`** -> `code`)
    let sanitized = markdown.replace(/\*\*`([^`]+)`\*\*/g, '`$1`')
    // Remove italic from within code blocks (e.g., *`code`* -> `code`)
    sanitized = sanitized.replace(/\*`([^`]+)`\*/g, '`$1`')
    // Remove bold/italic from within inline code (e.g., `**bold**` -> `bold`)
    sanitized = sanitized.replace(/`(\*\*[^*]+\*\*)`/g, '$1')
    sanitized = sanitized.replace(/`(\*[^*]+\*)`/g, '$1')
    return sanitized
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
          content: newReply.trim(),
        }),
      })

      if (!response.ok) throw new Error('AI request failed')

      const data = await response.json()
      if (data.data?.result) {
        const result = sanitizeMarkdown(data.data.result.trim())
        setNewReply(result)
      }
    } catch (error) {
      console.error('AI enhance error:', error)
    } finally {
      setIsProcessingAI(false)
    }
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

  // Handle retweet - opens quote retweet dialog on desktop, navigates on mobile
  const handleRetweet = () => {
    if (!comment) return
    if (isMobile) {
      router.push(`/retweet?id=${comment.id}&type=comment&messageId=${id}`)
    } else {
      setRetweetTarget(comment)
      setShowRetweetDialog(true)
    }
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

  // Handle retweet for child comments - opens dialog on desktop, navigates on mobile
  const handleChildRetweet = (childComment: Comment, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMobile) {
      router.push(`/retweet?id=${childComment.id}&type=comment&messageId=${id}`)
    } else {
      setRetweetTarget(childComment)
      setShowRetweetDialog(true)
    }
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

  const handleMarkdownImageClick = (index: number, url: string) => {
    const mediaCount = comment?.medias?.length || 0
    setCurrentMedias([
      ...(comment?.medias || []),
      ...markdownImages.map(img => ({ url: img, type: 'image' as const, id: img }))
    ])
    setLightboxIndex(mediaCount + index)
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
          parentId={comment.parentId}
          onNavigateBack={(targetId) => {
            router.push(`/status/${id}/comment/${targetId}`)
          }}
          onNavigateToMessage={() => router.push(`/status/${id}`)}
          onNavigateHome={() => router.push(`/?scrollto=${id}`)}
        />
      </div>

      {/* Comment Content */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-sm leading-5">
            {comment.author ? (
              <>
                <span className="font-bold text-foreground hover:underline">
                  {comment.author.name || "GoldieRill"}
                </span>
                <span className="text-muted-foreground">
                  @{getHandle(comment.author?.email || null, !!comment.author)}
                </span>
              </>
            ) : (
              <>
                <span className="font-bold text-purple-600 hover:underline">
                  GoldieRill
                </span>
                <span className="text-muted-foreground">
                  @AI
                </span>
              </>
            )}
            <span className="text-muted-foreground px-1">·</span>
            <span className="text-muted-foreground">
              {formatTime(comment.createdAt)}
            </span>
            {comment.updatedAt && new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime() + 1000 && (
              <>
                <span className="text-muted-foreground px-1">·</span>
                <span className="text-muted-foreground">已编辑</span>
              </>
            )}
            {comment.isAIBot && (
              <Bot className="h-4 w-4 text-primary ml-1" />
            )}

            {/* Tags displayed after user info */}
            {comment.tags && comment.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {comment.tags.map(({ tag }) => (
                  <span key={tag.id} className="text-primary hover:underline cursor-pointer">
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary">
                <MoreVertical className="h-5 w-5" />
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

        <div
          ref={contentRef}
          className={cn(
            "mt-4 text-sm leading-normal wrap-break-word break-words text-foreground overflow-hidden",
            !isExpanded && "line-clamp-9"
          )}
          style={!isExpanded ? {
            display: '-webkit-box',
            WebkitLineClamp: 9,
            WebkitBoxOrient: 'vertical',
          } : {}}
        >
          <TipTapViewer content={comment.content} onImageClick={handleMarkdownImageClick} />
        </div>
        {hasMore && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-primary text-sm font-medium mt-1 hover:underline text-left w-fit"
          >
            显示更多
          </button>
        )}

        {/* Media Display */}
        <MediaGrid
          medias={comment.medias || []}
          onImageClick={(index, e) => handleImageClick(index, comment.medias, e)}
          className="mt-4"
        />

        {/* 引用的消息卡片 - 类似 X/Twitter */}
        {comment.quotedMessage && (
          <QuotedMessageCard
            message={comment.quotedMessage}
          />
        )}

        <Separator className="my-1" />

        {/* Action Row */}
        <ActionRow
          replyCount={childComments.length}
          onReply={(e) => {
            e.stopPropagation()
            if (isMobile) {
              router.push(`/status/${id}/comment/${comment.id}/reply`)
            } else {
              setReplyTarget(comment)
              setShowReplyDialog(true)
            }
          }}
          copied={copiedId === comment.id}
          onCopy={() => handleCopy(comment.id, comment.content)}
          retweetCount={comment?.retweetCount ?? 0}
          onRetweet={handleRetweet}
          starred={starredComments.has(comment.id)}
          onToggleStar={() => handleToggleStar(comment.id)}
          onShare={() => handleShare(comment.id)}
          size="lg"
          className="px-2"
        />

        <Separator className="my-1" />
      </div>

      {/* Reply Input */}
      <CompactReplyInput
        value={newReply}
        onChange={setNewReply}
        media={uploadedMedia}
        onMediaChange={setUploadedMedia}
        isUploading={isUploading}
        onUploadingChange={setIsUploading}
        posting={posting}
        focused={replyInputFocused}
        onFocusedChange={setReplyInputFocused}
        templates={templates}
        onAICommandSelect={handleAICommandFromButton}
        onSubmit={handlePostReply}
      />

      {/* Child Comments List */}
      <div className="border-t">
        {childComments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            暂无回复，来说点什么吧
          </div>
        ) : (
          childComments.map((childComment) => (
            <CommentItem
              key={childComment.id}
              comment={childComment}
              onClick={() => router.push(`/status/${id}/comment/${childComment.id}`)}
              onEditClick={(e) => {
                e.stopPropagation()
                router.push(`/status/${id}/comment/${childComment.id}/edit`)
              }}
              onDeleteClick={(e) => {
                e.stopPropagation()
                setShowDeleteDialog(true)
              }}
              replyCount={childComment._count?.replies || 0}
              onReply={(e) => {
                e.stopPropagation()
                if (isMobile) {
                  router.push(`/status/${id}/comment/${childComment.id}/reply`)
                } else {
                  setReplyTarget(childComment)
                  setShowReplyDialog(true)
                }
              }}
              copied={copiedId === childComment.id}
              onCopy={(e) => {
                e.stopPropagation()
                handleCopy(childComment.id, childComment.content)
              }}
              retweetCount={childComment.retweetCount ?? 0}
              onRetweet={(e) => handleChildRetweet(childComment, e)}
              starred={starredComments.has(childComment.id)}
              onToggleStar={(e) => {
                e.stopPropagation()
                handleToggleStar(childComment.id)
              }}
              onShare={(e) => {
                e.stopPropagation()
                handleShare(childComment.id)
              }}
              onImageClick={(index, e) => handleImageClick(index, childComment.medias, e)}
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

      {/* Share Dialog */}
      <ShareDialog
        messageId={shareItemId || comment.id}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        type="comment"
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
        media={[
          ...(currentMedias || []),
          ...markdownImages.map(url => ({ url, type: 'image' }))
        ]}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  )
}
