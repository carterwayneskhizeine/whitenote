"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { commentsApi, aiApi } from "@/lib/api"
import { Loader2, Image as ImageIcon, Smile, List, Calendar, MapPin, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useSession } from "next-auth/react"
import { TipTapViewer } from "@/components/TipTapViewer"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { getHandle } from "@/lib/utils"

interface ReplyTarget {
    id: string
    content: string
    createdAt: string
    author: {
        name: string | null
        avatar: string | null
        email: string | null
    } | null
}

interface ReplyDialogProps {
    target: ReplyTarget | null
    messageId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function ReplyDialog({
    target,
    messageId,
    open,
    onOpenChange,
    onSuccess,
}: ReplyDialogProps) {
    const { data: session } = useSession()
    const [content, setContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Reset content and pre-fill mention if replying to a comment
    useEffect(() => {
        if (open && target) {
            const handle = getHandle(target.author?.email || null, !!target.author)
            // If it's a comment (different from messageId), pre-fill the handle
            // Actually, in Twitter, you always reply to someone.
            // For now, let's just pre-fill if it's not the same as messageId or just always focus.
            setContent("")
        }
    }, [open, target, messageId])

    if (!target) return null

    const handleReply = async () => {
        if (!content.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            // Determine parentId: if target.id is not messageId, it's a comment reply
            const parentId = target.id !== messageId ? target.id : undefined

            const result = await commentsApi.createComment({
                content: content.trim(),
                messageId: messageId,
                parentId: parentId,
            })

            if (result.data) {
                // Check if comment contains @goldierill and trigger AI reply
                if (content.includes('@goldierill')) {
                    try {
                        const question = content.replace('@goldierill', '').trim()
                        await aiApi.chat({
                            messageId: messageId,
                            content: question || '请回复这条评论',
                        })
                    } catch (aiError) {
                        console.error("Failed to get AI reply:", aiError)
                    }
                }

                setContent("")
                onOpenChange(false)
                onSuccess?.()
            }
        } catch (error) {
            console.error("Failed to post reply:", error)
        } finally {
            setIsSubmitting(false)
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

    const targetHandle = getHandle(target.author?.email || null, !!target.author)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 border-none bg-background overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="flex flex-row items-center justify-between px-4 py-2 border-b">
                    <DialogTitle className="sr-only">回复</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" className="text-primary font-bold hover:bg-transparent">草稿</Button>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex gap-3 relative">
                        {/* Thread line */}
                        <div className="absolute left-[15px] top-10 bottom-0 w-0.5 bg-border" />

                        <GoldieAvatar
                            name={target.author?.name || null}
                            avatar={target.author?.avatar || null}
                            size="md"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-sm">
                                <span className="font-bold text-foreground">
                                    {target.author?.name || "GoldieRill"}
                                </span>
                                <span className="text-muted-foreground truncate">
                                    @{targetHandle}
                                </span>
                                <span className="text-muted-foreground px-1">·</span>
                                <span className="text-muted-foreground">
                                    {formatTime(target.createdAt)}
                                </span>
                            </div>
                            <div className="mt-1 text-sm leading-normal">
                                <TipTapViewer content={target.content} />
                            </div>
                            <div className="mt-3 text-sm text-muted-foreground">
                                回复给 <span className="text-primary">@{targetHandle}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={session?.user?.image || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {session?.user?.name?.slice(0, 2) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex flex-col min-w-0">
                            <Textarea
                                placeholder="发布你的回复"
                                className="min-h-[120px] w-full bg-transparent border-none focus-visible:ring-0 text-lg p-0 resize-none placeholder:text-muted-foreground"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t flex items-center justify-between">
                    <div className="flex gap-1 text-primary">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full">
                            <ImageIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full">
                            <span className="font-bold text-[10px] border border-current rounded px-0.5">GIF</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full">
                            <List className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full">
                            <Smile className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full">
                            <Calendar className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full opacity-50 cursor-not-allowed">
                            <MapPin className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            className="rounded-full px-5 font-bold h-9 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                            disabled={!content.trim() || isSubmitting}
                            onClick={handleReply}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "回复"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
