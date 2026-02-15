"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { ShareDialog } from "@/components/ShareDialog"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useShare } from "@/hooks/useShare"
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
}

export function MessageCard({
  message,
  onUpdate,
  onDelete,
}: MessageCardProps) {
  const isMobile = useMobile()
  const [isStarred, setIsStarred] = useState(message.isStarred)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [showRetweetDialog, setShowRetweetDialog] = useState(false)
  const { showShareDialog, setShowShareDialog, handleShare: openShareDialog } = useShare()
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [markdownImages, setMarkdownImages] = useState<string[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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

  // Handle markdown image click to open lightbox
  const handleMarkdownImageClick = useCallback((index: number, url: string) => {
    // Calculate index: uploaded media + markdown image index
    const mediaCount = message.medias?.length || 0
    const targetIndex = mediaCount + index

    console.log('handleMarkdownImageClick - markdown index:', index, 'mediaCount:', mediaCount, 'targetIndex:', targetIndex)

    // Batch both updates together
    setLightboxIndex(targetIndex)
    setLightboxOpen(true)
  }, [message.medias?.length])

  // Extract markdown images from content
  useEffect(() => {
    // 使用 Set 去重，确保相同的 URL 只出现一次
    const images = Array.from(new Set(
      message.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
        const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
        return url || ''
      }).filter(url => url && !url.startsWith('data:')) || []
    ))
    //console.log('MessageCard - medias:', message.medias?.length || 0)
    //console.log('MessageCard - markdownImages:', images.length)
    //console.log('MessageCard - total:', (message.medias?.length || 0) + images.length)
    setMarkdownImages(images)
  }, [message.content, message.medias?.length])

  // 移动端单击、桌面端双击（1秒内）
  const handleClick = useDoubleClick({
    onDoubleClick: () => router.push(`/status/${message.id}`),
    forceMobile: isMobile,
  })

  return (
    <>
      <div
        id={`message-${message.id}`}
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
                updatedAt={message.updatedAt}
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
                className="mt-1 text-sm break-words text-foreground leading-normal"
              >
                <TipTapViewer 
                  content={message.content} 
                  onImageClick={handleMarkdownImageClick}
                  maxLines={9}
                  isExpanded={isExpanded}
                  onOverflow={setHasMore}
                />
              </div>
              {hasMore && !isExpanded && (
                <button
                  ref={buttonRef}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()

                    // Store viewport position before expansion
                    const currentScrollY = window.scrollY
                    const buttonRect = buttonRef.current?.getBoundingClientRect()
                    if (!buttonRect) {
                      setIsExpanded(true)
                      return
                    }

                    // The button's position relative to viewport
                    const buttonTop = buttonRect.top
                    const buttonBottom = buttonRect.bottom

                    // Expand the content
                    setIsExpanded(true)

                    // After expansion, scroll to maintain the button's original position in viewport
                    // This makes the new content appear below where the button was
                    requestAnimationFrame(() => {
                      // We want to scroll so the area that was visible before expansion stays visible
                      // The new content should appear below the button's original position
                      const targetScrollY = Math.max(0, currentScrollY + buttonBottom - window.innerHeight * 0.7)
                      window.scrollTo({
                        top: targetScrollY,
                        behavior: 'instant'
                      })
                    })
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
              onShare={(e) => {
                e.stopPropagation()
                openShareDialog(message.id)
              }}
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
          // Scroll to the replied message
          setTimeout(() => {
            const element = document.getElementById(`message-${message.id}`)
            element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
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
          // Scroll to top to show the new retweet message
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }, 100)
        }}
      />

      {/* Share Dialog */}
      <ShareDialog
        messageId={message.id}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
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
        key={`lightbox-${lightboxOpen ? 'open' : 'closed'}-${lightboxIndex}`}
        media={[
          ...(message.medias || []),
          ...markdownImages.map(url => ({ url, type: 'image' }))
        ]}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
