"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import {
  Loader2,
  Bot,
  Image as ImageIcon,
  Smile,
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
import { commentsApi, aiApi } from "@/lib/api"
import { Comment } from "@/types/api"
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
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = comment.content
      const textContent = tempDiv.textContent || tempDiv.innerText || ''

      await navigator.clipboard.writeText(textContent)
      setCopiedId(comment.id)
      setTimeout(() => setCopiedId(null), 2000)
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

  // Post new comment
  const handlePostComment = async () => {
    if (!newComment.trim() || posting) return

    setPosting(true)
    try {
      const result = await commentsApi.createComment({
        content: newComment.trim(),
        messageId,
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
        onCommentAdded?.()
      }
    } catch (error) {
      console.error("Failed to post comment:", error)
    } finally {
      setPosting(false)
    }
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
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-1 text-primary">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary hover:bg-primary/10">
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary hover:bg-primary/10">
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="rounded-full px-5 font-bold h-9 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                disabled={!newComment.trim() || posting}
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
    </div>
  )
}
