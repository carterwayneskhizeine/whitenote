"use client"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Heart,
  Repeat2,
  Share,
  MoreVertical,
  Trash2,
  Edit2,
  MessageCircle,
  BarChart2,
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
import { cn } from "@/lib/utils"

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
  const [isEditing, setIsEditing] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contentRef.current && !isEditing) {
      const el = contentRef.current
      // Create a temporary hidden clone with line-clamp to check for overflow
      // Or just check scrollHeight vs a fixed max-height if we use line-clamp
      // A more reliable way is to check scrollHeight against clientHeight when line-clamp is applied
      if (el.scrollHeight > el.clientHeight) {
        setHasMore(true)
      } else {
        setHasMore(false)
      }
    }
  }, [message.content, isEditing])

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
    onReply?.()
    setShowComments(true)
  }

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      const result = await messagesApi.updateMessage(message.id, {
        content: editContent,
      })
      if (result.data) {
        setIsEditing(false)
        onUpdate?.()
      }
    } catch (error) {
      console.error("Failed to update message:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <>
      <div
        className="p-4 border-b border-border hover:bg-muted/10 transition-colors cursor-pointer"
        onClick={() => { if (!isEditing) { /* Navigate to detail */ } }}
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
            {/* Header: Name @handle · Time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm leading-5 truncate">
                <span className="font-bold text-foreground hover:underline">
                  {message.author.name || "Anonymous"}
                </span>
                <span className="text-muted-foreground truncate">
                  @{message.author.email?.split('@')[0] || "user"}
                </span>
                <span className="text-muted-foreground px-1">·</span>
                <span className="text-muted-foreground hover:underline">
                  {formatTime(message.createdAt)}
                </span>
              </div>
              <div className="flex items-center">
                {message.isPinned && <Pin className="h-4 w-4 text-muted-foreground fill-current mr-2" />}
                {!isEditing && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full -mr-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
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
                )}
              </div>
            </div>

            {/* Message Body / Edit Interface */}
            {isEditing ? (
              <div className="mt-2 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="w-full min-h-[100px] p-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => { setIsEditing(false); setEditContent(message.content); }}
                    disabled={isUpdating}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full text-xs bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 border border-border"
                    onClick={handleUpdate}
                    disabled={isUpdating || editContent === message.content}
                  >
                    {isUpdating ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div
                  ref={contentRef}
                  className={cn(
                    "mt-1 text-sm whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none text-foreground leading-normal overflow-hidden",
                    !isExpanded && "line-clamp-[9]"
                  )}
                  style={!isExpanded ? {
                    display: '-webkit-box',
                    WebkitLineClamp: 9,
                    WebkitBoxOrient: 'vertical',
                  } : {}}
                  dangerouslySetInnerHTML={{ __html: message.content }}
                />
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
              </div>
            )}

            {/* Tags (if any) */}
            {message.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-primary">
                {message.tags.map(({ tag }) => (
                  <span key={tag.id} className="text-sm hover:underline">
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}

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

              {/* 2. Repost (Cycle) */}
              <div className="group flex items-center">
                <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                  <Repeat2 className="h-[18px] w-[18px] text-muted-foreground group-hover:text-green-500 transition-colors" />
                </div>
              </div>

              {/* 3. Like (Heart) */}
              <div onClick={handleToggleStar} className="group flex items-center cursor-pointer">
                <div className="p-2 rounded-full group-hover:bg-pink-500/10 transition-colors">
                  <Heart
                    className={cn(
                      "h-[18px] w-[18px] transition-colors",
                      isStarred ? "text-pink-600 fill-pink-600" : "text-muted-foreground group-hover:text-pink-500"
                    )}
                  />
                </div>
                {isStarred && (
                  <span className="text-xs text-pink-600">{starCount > 0 ? starCount : 1}</span>
                )}
              </div>

              {/* 4. Views (Stat) */}
              <div className="group flex items-center">
                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <BarChart2 className="h-[18px] w-[18px] text-muted-foreground group-hover:text-blue-500 transition-colors" />
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

      {/* Inline Comments */}
      {showComments && (
        <CommentsList
          messageId={message.id}
          onCommentAdded={() => {
            onUpdate?.()
          }}
        />
      )}

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
