"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Star,
  Pin,
  PinOff,
  MoreVertical,
  Trash2,
  Edit2,
  MessageCircle,
  ArrowBigRight,
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
  const [isPinned, setIsPinned] = useState(message.isPinned)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showComments, setShowComments] = useState(false)

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

  // Handle star toggle
  const handleToggleStar = async () => {
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
        setIsPinned(result.data.isPinned)
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
  const handleReply = () => {
    onReply?.()
    setShowComments(true)
  }

  // Toggle comments
  const toggleComments = () => {
    setShowComments(!showComments)
  }

  return (
    <>
      <div className="p-4 border-b hover:bg-muted/20 transition-colors">
        <div className="flex gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={message.author.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {getInitials(message.author.name)}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm hover:underline">
                {message.author.name || "Anonymous"}
              </span>
              <span className="text-muted-foreground text-sm">
                {formatTime(message.createdAt)}
              </span>
              {isPinned && (
                <Pin className="h-3.5 w-3.5 text-primary fill-current" />
              )}
            </div>

            {/* Message content */}
            <div
              className="mt-1 text-sm whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />

            {/* Tags */}
            {message.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.tags.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-3 flex items-center justify-between max-w-md">
              <div className="flex items-center gap-1">
                {/* Reply/Comments button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                  onClick={toggleComments}
                >
                  <MessageCircle className="h-4 w-4" />
                  {message._count.comments > 0 && (
                    <span className="ml-1 text-xs">{message._count.comments}</span>
                  )}
                </Button>

                {/* Respawn button */}
                {message._count.children > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-green-600 hover:bg-green-600/10 rounded-full"
                  >
                    <ArrowBigRight className="h-4 w-4" />
                    <span className="ml-1 text-xs">{message._count.children}</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Star button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full transition-colors ${
                    isStarred
                      ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"
                      : "text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10"
                  }`}
                  onClick={handleToggleStar}
                >
                  {isStarred ? (
                    <Star className="h-4 w-4 fill-current" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                </Button>

                {/* Pin button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full transition-colors ${
                    isPinned
                      ? "text-primary hover:text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  }`}
                  onClick={handleTogglePin}
                >
                  {isPinned ? (
                    <Pin className="h-4 w-4 fill-current" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </Button>

                {/* More menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleTogglePin}
                      className={isPinned ? "text-muted-foreground" : ""}
                    >
                      {isPinned ? (
                        <PinOff className="h-4 w-4 mr-2" />
                      ) : (
                        <Pin className="h-4 w-4 mr-2" />
                      )}
                      {isPinned ? "取消置顶" : "置顶"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <CommentsList
          messageId={message.id}
          onCommentAdded={() => {
            onUpdate?.()
            fetch(`/api/messages/${message.id}`)
              .then((r) => r.json())
              .then((data) => {
                if (data.data) {
                  // Update comment count
                }
              })
          }}
        />
      )}

      {/* Delete confirmation dialog */}
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
