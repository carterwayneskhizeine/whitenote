"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  MoreVertical,
  Trash2,
  Edit2,
  Pin,
  PinOff
} from "lucide-react"
import { Message, messagesApi } from "@/lib/api/messages"
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
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CommentsList } from "@/components/CommentsList"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { cn, getHandle } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { TipTapViewer } from "@/components/TipTapViewer"
import { ImageLightbox } from "@/components/ImageLightbox"
import { MediaGrid } from "@/components/MediaGrid"
import { ActionRow } from "@/components/ActionRow"
import { UserInfoWithTags } from "@/components/UserInfoWithTags"
import { useMobile } from "@/hooks/use-mobile"
import { useDoubleClick } from "@/hooks/useDoubleClick"

interface MessageCardProps {
  message: Message
  onUpdate?: () => void
  onDelete?: (deletedId: string) => void
  onReply?: () => void
  showChildren?: boolean
}

export function MessageCard({
  message,
  onUpdate,
  onDelete,
  onReply,
  showChildren = false,
}: MessageCardProps) {
  const isMobile = useMobile()
  const [isStarred, setIsStarred] = useState(message.isStarred)
  const [starCount, setStarCount] = useState(0) // Mock count or real if available
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [showRetweetDialog, setShowRetweetDialog] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 检测内容是否需要"显示更多"按钮
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
  }, [message.content])

  // Format relative time
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

  // Handle star (Like) toggle
  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await messagesApi.toggleStar(message.id)
      if (result.data) {
        setIsStarred(result.data.isStarred)
        setStarCount(prev => result.data?.isStarred ? prev + 1 : prev - 1)
        onUpdate?.()
      }
    } catch (error) {
      console.error("Failed to toggle star:", error)
    }
  }

  // Handle pin toggle
  const handleTogglePin = async () => {
    try {
      const result = await messagesApi.togglePin(message.id)
      if (result.data) {
        onUpdate?.()
      }
    } catch (error) {
      console.error("Failed to toggle pin:", error)
    }
  }

  // Handle retweet - opens quote retweet dialog on desktop, navigates on mobile
  const handleRetweet = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMobile) {
      router.push(`/retweet?id=${message.id}&type=message`)
    } else {
      setShowRetweetDialog(true)
    }
  }


  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await messagesApi.deleteMessage(message.id)
      if (result.success) {
        onDelete?.(message.id)
      }
    } catch (error) {
      console.error("Failed to delete message:", error)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Handle reply - opens dialog on desktop, navigates on mobile
  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMobile) {
      router.push(`/status/${message.id}/reply`)
    } else {
      setShowReplyDialog(true)
    }
  }

  // Handle copy
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      // Copy the raw Markdown content directly (preserves code blocks and formatting)
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    } catch (error) {
      console.error("Failed to copy message:", error)
    }
  }

  // Handle image click to open lightbox
  const handleImageClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // 移动端单击、桌面端双击（1秒内）
  const handleClick = useDoubleClick({
    onDoubleClick: () => router.push(`/status/${message.id}`),
    forceMobile: isMobile,
  })

  return (
    <>
      <div
        className="p-4 border-b border-border hover:bg-muted/10 transition-colors cursor-pointer"
        onClick={handleClick}
      >
        <div className="flex gap-3">
          {/* Avatar Column - h-8 to match reply as standard */}
          <div className="shrink-0">
            <GoldieAvatar
              name={message.author?.name || null}
              avatar={message.author?.avatar || null}
              size="md"
              isAI={!message.author}
            />
          </div>

          {/* Content Column */}
          <div className="flex-1 min-w-0">
            {/* Header: Name @handle · Time #Tags */}
            <div className="flex items-start justify-between gap-2">
              <UserInfoWithTags
                author={message.author}
                createdAt={message.createdAt}
                tags={message.tags}
                size="md"
                align="baseline"
                containerClassName="text-sm leading-5"
              />
              <div className="flex items-center">
                {message.isPinned && <Pin className="h-4 w-4 text-muted-foreground fill-current mr-2" />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full -mr-2">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/status/${message.id}/edit`)
                    }}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTogglePin(); }}>
                      {message.isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                      {message.isPinned ? "取消置顶" : "置顶"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Message Body */}
            <div className="flex flex-col">
              <div
                ref={contentRef}
                className={cn(
                  "mt-1 text-sm break-words text-foreground leading-normal overflow-hidden",
                  !isExpanded && "line-clamp-[9]"
                )}
                style={!isExpanded ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 9,
                  WebkitBoxOrient: 'vertical',
                } : {}}
              >
                <TipTapViewer content={message.content} />
              </div>
              {hasMore && !isExpanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                  }}
                  className="text-primary text-sm font-medium mt-1 hover:underline text-left w-fit"
                >
                  显示更多
                </button>
              )}

              {/* Media Display */}
              <MediaGrid
                medias={message.medias || []}
                onImageClick={handleImageClick}
                className="mt-3"
              />

              {/* Quoted Message/Comment Card */}
              {(message.quotedMessage || message.quotedComment) && (
                <QuotedMessageCard message={message.quotedMessage || message.quotedComment!} />
              )}
            </div>

            {/* Action Bar (Footer) */}
            <ActionRow
              replyCount={message._count.comments}
              onReply={handleReply}
              copied={copied}
              onCopy={handleCopy}
              retweetCount={message.retweetCount ?? 0}
              onRetweet={handleRetweet}
              starred={isStarred}
              onToggleStar={handleToggleStar}
              onShare={undefined}
              size="md"
              className="mt-3"
            />
          </div>
        </div>
      </div>

      {/* Reply Dialog */}
      <ReplyDialog
        open={showReplyDialog}
        onOpenChange={setShowReplyDialog}
        target={message}
        messageId={message.id}
        onSuccess={() => {
          onUpdate?.()
        }}
      />

      {/* Retweet Dialog */}
      <RetweetDialog
        open={showRetweetDialog}
        onOpenChange={setShowRetweetDialog}
        target={message}
        targetType="message"
        onSuccess={() => {
          onUpdate?.()
          // Navigate to home to show the new message
          router.push('/')
          // Trigger auto-refresh after 5 seconds (for AI tags)
          window.dispatchEvent(new CustomEvent('message-posted'))
        }}
      />

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除消息</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条消息吗？此操作无法撤销。
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
        media={message.medias || []}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
