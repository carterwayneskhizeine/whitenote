"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Message, messagesApi } from "@/lib/api/messages"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MoreHorizontal, MessageCircle, Repeat2, Share, Bookmark, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CommentsList } from "@/components/CommentsList"
import { TipTapViewer } from "@/components/TipTapViewer"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"

export default function StatusPage() {
    const { id } = useParams() as { id: string }
    const router = useRouter()
    const [message, setMessage] = useState<Message | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [showReplyDialog, setShowReplyDialog] = useState(false)
    const [replyTarget, setReplyTarget] = useState<any>(null)
    const [showRetweetDialog, setShowRetweetDialog] = useState(false)

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
    }, [id])

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
                        <span className="font-bold text-foreground leading-tight hover:underline cursor-pointer">
                            {message.author.name || "Anonymous"}
                        </span>
                        <span className="text-muted-foreground text-sm leading-tight">
                            @{message.author.email?.split('@')[0] || "user"}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
                        <MoreHorizontal className="h-5 w-5" />
                    </Button>
                </div>

                <div className="mt-4 text-[22px] leading-normal wrap-break-word">
                    <TipTapViewer content={message.content} />
                </div>

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
                        onClick={() => setShowRetweetDialog(true)}
                    >
                        <div className="p-2 rounded-full group-hover:bg-green-500/10 group-hover:text-green-500 transition-colors">
                            <Repeat2 className="h-[22px] w-[22px]" />
                        </div>
                        {(typeof message.retweetCount === 'number' && message.retweetCount > 0) && (
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
                        <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                            <Bookmark className={cn("h-[22px] w-[22px]", message.isStarred && "text-blue-600 fill-blue-600")} />
                        </div>
                        <span className="text-sm">{message.isStarred ? "已收藏" : "收藏"}</span>
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
                    // Refresh page or list
                    window.location.reload()
                }}
            />

            {/* Reply Dialog */}
            <ReplyDialog
                open={showReplyDialog}
                onOpenChange={setShowReplyDialog}
                target={replyTarget}
                messageId={message.id}
                onSuccess={() => {
                    // Refresh page
                    window.location.reload()
                }}
            />

            {/* Retweet Dialog */}
            <RetweetDialog
                open={showRetweetDialog}
                onOpenChange={setShowRetweetDialog}
                target={message}
                onSuccess={() => {
                    // Navigate to home to show the new message
                    router.push('/')
                }}
            />
        </div>
    )
}
