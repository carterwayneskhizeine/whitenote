"use client"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Bookmark,
  BookmarkCheck,
  Copy,
  Share,
  MoreVertical,
  Trash2,
  Edit2,
  MessageCircle,
  Repeat2,
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
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { TipTapViewer } from "@/components/TipTapViewer"

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

  // Get user initials from name or email
  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

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

  // Handle retweet - opens quote retweet dialog
  const handleRetweet = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowRetweetDialog(true)
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

  // Handle reply
  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowReplyDialog(true)
  }

  // Handle copy
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      // Create a temporary div to render the TipTap content
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = message.content
      const textContent = tempDiv.textContent || tempDiv.innerText || ''

      await navigator.clipboard.writeText(textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy message:", error)
    }
  }

  return (
    <>
      <div
        className="p-4 border-b border-border hover:bg-muted/10 transition-colors cursor-pointer"
        onClick={() => { router.push(`/status/${message.id}`) }}
      >
        <div className="flex gap-3">
          {/* Avatar Column - h-8 to match reply as standard */}
          <div className="shrink-0">
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.author.avatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(message.author.name)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Content Column */}
          <div className="flex-1 min-w-0">
            {/* Header: Name @handle · Time #Tags */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-sm leading-5">
                <span className="font-bold text-foreground hover:underline">
                  {message.author.name || "Anonymous"}
                </span>
                <span className="text-muted-foreground">
                  @{message.author.email?.split('@')[0] || "user"}
                </span>
                <span className="text-muted-foreground px-1">·</span>
                <span className="text-muted-foreground hover:underline">
                  {formatTime(message.createdAt)}
                </span>

                {/* Tags displayed after user info */}
                {message.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {message.tags.map(({ tag }) => (
                      <span key={tag.id} className="text-primary hover:underline cursor-pointer">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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

              {/* Quoted Message Card */}
              {message.quotedMessage && (
                <QuotedMessageCard message={message.quotedMessage} />
              )}
            </div>

            {/* Action Bar (Footer) */}
            <div className="mt-3 flex items-center justify-between max-w-[425px]">
              {/* 1. Reply */}
              <div
                className="group flex items-center -ml-2 cursor-pointer"
                onClick={handleReply}
              >
                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <MessageCircle className="h-[18px] w-[18px] text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </div>
                {message._count.comments > 0 && (
                  <span className="text-xs text-muted-foreground group-hover:text-blue-500 transition-colors">{message._count.comments}</span>
                )}
              </div>

              {/* 2. Retweet */}
              <div onClick={handleRetweet} className="group flex items-center cursor-pointer">
                <div className={cn(
                  "p-2 rounded-full transition-colors",
                  "group-hover:bg-green-500/10"
                )}>
                  <Repeat2 className={cn(
                    "h-[18px] w-[18px] transition-colors",
                    "text-muted-foreground group-hover:text-green-500"
                  )} />
                </div>
                {(message.retweetCount ?? 0) > 0 && (
                  <span className="text-xs text-foreground/60 group-hover:text-green-600 transition-colors">{message.retweetCount}</span>
                )}
              </div>

              {/* 3. Copy */}
              <div onClick={handleCopy} className="group flex items-center cursor-pointer">
                <div className={cn(
                  "p-2 rounded-full transition-colors",
                  copied ? "bg-green-500/20" : "group-hover:bg-green-500/10"
                )}>
                  <Copy className={cn(
                    "h-[18px] w-[18px] transition-colors",
                    copied ? "text-green-500" : "text-muted-foreground group-hover:text-green-500"
                  )} />
                </div>
              </div>

              {/* 4. Bookmark */}
              <div onClick={handleToggleStar} className="group flex items-center cursor-pointer">
                <div className="p-2 rounded-full group-hover:bg-yellow-500/10 transition-colors">
                  {isStarred ? (
                    <BookmarkCheck className="h-[18px] w-[18px] text-yellow-600 fill-yellow-600 transition-colors" />
                  ) : (
                    <Bookmark className="h-[18px] w-[18px] text-muted-foreground group-hover:text-yellow-600 transition-colors" />
                  )}
                </div>
              </div>

              {/* 5. Share */}
              <div className="group flex items-center -mr-2">
                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <Share className="h-[18px] w-[18px] text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            </div>
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
    </>
  )
}
