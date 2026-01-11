"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Message, messagesApi } from "@/lib/api/messages"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MoreVertical, MessageCircle, Repeat2, Share, Bookmark, Loader2, Edit2, Pin, PinOff, Trash2, Copy } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CommentsList } from "@/components/CommentsList"
import { TipTapViewer } from "@/components/TipTapViewer"
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
import { cn, getHandle } from "@/lib/utils"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"

export default function StatusPage() {
    const { id } = useParams() as { id: string }
    const router = useRouter()
    const [message, setMessage] = useState<Message | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [showReplyDialog, setShowReplyDialog] = useState(false)
    const [replyTarget, setReplyTarget] = useState<any>(null)
    const [showRetweetDialog, setShowRetweetDialog] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const fetchMessage = async () => {
            try {
                const result = await messagesApi.getMessage(id)
                if (result.data) {
                    setMessage(result.data)
                } else if (result.error) {
                    setError(result.error)
                }
            } catch (err) {
                console.error("Failed to fetch message:", err)
                setError("Failed to load message")
            } finally {
                setIsLoading(false)
            }
        }

        if (id) {
            fetchMessage()
        }
    }, [id, refreshKey])

    const handleTogglePin = async () => {
        if (!message) return
        try {
            const result = await messagesApi.togglePin(message.id)
            if (result.data) {
                setMessage({ ...message, isPinned: result.data.isPinned })
            }
        } catch (error) {
            console.error("Failed to toggle pin:", error)
        }
    }

    const handleDelete = async () => {
        if (!message) return
        setIsDeleting(true)
        try {
            const result = await messagesApi.deleteMessage(message.id)
            if (result.success) {
                router.push('/')
            }
        } catch (error) {
            console.error("Failed to delete message:", error)
        } finally {
            setIsDeleting(false)
            setShowDeleteDialog(false)
        }
    }

    const handleCopy = async () => {
        if (!message) return
        try {
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !message) {
        return (
            <div className="p-8 text-center">
                <p className="text-muted-foreground mb-4">{error || "Message not found"}</p>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        )
    }


    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border flex items-center px-4 h-[53px]">
                <Button
                    variant="ghost"
                    size="icon"
                    className="mr-4 rounded-full"
                    onClick={() => router.push('/')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold">帖子</h1>
            </div>

            {/* Main Post Content */}
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                        {message.author ? (
                            <>
                                <span className="font-bold text-foreground leading-tight hover:underline cursor-pointer">
                                    {message.author.name || "GoldieRill"}
                                </span>
                                <span className="text-muted-foreground text-sm leading-tight">
                                    @{getHandle(message.author?.email || null, !!message.author)}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="font-bold text-purple-600 leading-tight hover:underline cursor-pointer">
                                    GoldieRill
                                </span>
                                <span className="text-muted-foreground text-sm leading-tight">
                                    @AI
                                </span>
                            </>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/status/${message.id}/edit`)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleTogglePin}>
                                {message.isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                                {message.isPinned ? "取消置顶" : "置顶"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="mt-4 text-sm leading-normal wrap-break-word">
                    <TipTapViewer content={message.content} />
                </div>

                {/* 引用的消息/评论卡片 - 转推时显示 */}
                {(message.quotedMessage || message.quotedComment) && (
                    <QuotedMessageCard message={message.quotedMessage || message.quotedComment!} />
                )}

                {/* Media Display */}
                {message.medias && message.medias.length > 0 && (() => {
                    const mediaCount = message.medias.length
                    return (
                        <div className={cn(
                            "mt-4 grid gap-2 rounded-lg overflow-hidden border border-border",
                            mediaCount === 1 && "grid-cols-1",
                            mediaCount === 2 && "grid-cols-2",
                            mediaCount === 3 && "grid-cols-2",
                            mediaCount === 4 && "grid-cols-2"
                        )}>
                            {message.medias.map((media, index) => (
                                <div key={media.id} className={cn(
                                    "relative overflow-hidden",
                                    mediaCount === 1 && "aspect-auto",
                                    mediaCount !== 1 && "aspect-square",
                                    mediaCount === 3 && index === 0 && "col-span-2"
                                )}>
                                    {media.type === "image" ? (
                                        <img
                                            src={media.url}
                                            alt={media.description || ""}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : media.type === "video" ? (
                                        <video
                                            src={media.url}
                                            controls
                                            className="w-full h-full"
                                        />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )
                })()}

                <div className="mt-4 flex flex-wrap gap-1 text-muted-foreground text-[15px]">
                    <span>{format(new Date(message.createdAt), "a h:mm · yyyy'年'M'月'd'日'", { locale: zhCN })}</span>
                    <span className="px-1">·</span>
                    <span className="font-bold text-foreground">3.6万</span>
                    <span>查看</span>
                </div>

                <Separator className="my-4" />

                {/* Stats Row */}
                <div className="flex items-center justify-between px-2 text-muted-foreground">
                    <div
                        className="flex items-center gap-1 group cursor-pointer"
                        onClick={() => {
                            setReplyTarget(message)
                            setShowReplyDialog(true)
                        }}
                    >
                        <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                            <MessageCircle className="h-[22px] w-[22px]" />
                        </div>
                        <span className="text-sm">{message._count.comments}</span>
                    </div>
                    <div
                        className="flex items-center gap-1 group cursor-pointer"
                        onClick={handleCopy}
                    >
                        <div className={cn(
                            "p-2 rounded-full transition-colors",
                            copied ? "bg-green-500/20" : "group-hover:bg-green-500/10"
                        )}>
                            <Copy className={cn(
                                "h-[22px] w-[22px] transition-colors",
                                copied ? "text-green-500" : "group-hover:text-green-500"
                            )} />
                        </div>
                    </div>
                    <div
                        className="flex items-center gap-1 group cursor-pointer"
                        onClick={() => setShowRetweetDialog(true)}
                    >
                        <div className="p-2 rounded-full group-hover:bg-green-500/10 group-hover:text-green-500 transition-colors">
                            <Repeat2 className="h-[22px] w-[22px]" />
                        </div>
                        {(message.retweetCount ?? 0) > 0 && (
                            <span className="text-sm text-foreground/60 group-hover:text-green-600 transition-colors">{message.retweetCount}</span>
                        )}
                    </div>
                    <div
                        className="flex items-center gap-1 group cursor-pointer"
                        onClick={async () => {
                            const result = await messagesApi.toggleStar(message.id)
                            if (result.data) {
                                setMessage({ ...message, isStarred: result.data.isStarred })
                            }
                        }}
                    >
                        <div className="p-2 rounded-full group-hover:bg-yellow-500/10 group-hover:text-yellow-600 transition-colors">
                            <Bookmark className={cn("h-[22px] w-[22px]", message.isStarred && "text-yellow-600 fill-yellow-600")} />
                        </div>
                    </div>
                    <div className="flex items-center group cursor-pointer">
                        <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                            <Share className="h-[22px] w-[22px]" />
                        </div>
                    </div>
                </div>

                <Separator className="my-4" />
            </div>

            {/* Reply Section */}
            <CommentsList
                messageId={message.id}
                onCommentAdded={() => {
                    // Refresh message data to update comment count
                    setRefreshKey(prev => prev + 1)
                }}
            />

            {/* Reply Dialog */}
            <ReplyDialog
                open={showReplyDialog}
                onOpenChange={setShowReplyDialog}
                target={replyTarget}
                messageId={message.id}
                onSuccess={() => {
                    // Refresh message data to update comment count
                    setRefreshKey(prev => prev + 1)
                }}
            />

            {/* Retweet Dialog */}
            <RetweetDialog
                open={showRetweetDialog}
                onOpenChange={setShowRetweetDialog}
                target={message}
                targetType="message"
                onSuccess={() => {
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
        </div>
    )
}
