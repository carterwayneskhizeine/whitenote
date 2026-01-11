"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { messagesApi, commentsApi } from "@/lib/api"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useSession } from "next-auth/react"
import { TipTapViewer } from "@/components/TipTapViewer"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { getHandle } from "@/lib/utils"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { ActionButtons } from "@/components/ActionButtons"
import { templatesApi } from "@/lib/api/templates"
import { Template } from "@/types/api"
import { useState, useEffect, useRef } from "react"

interface RetweetTarget {
    id: string
    content: string
    createdAt: string
    author: {
        name: string | null
        avatar: string | null
        email: string | null
    } | null
    medias?: Array<{
        id: string
        url: string
        type: string
        description?: string | null
    }>
}

interface RetweetDialogProps {
    target: RetweetTarget | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    targetType?: 'message' | 'comment'
}

export function RetweetDialog({
    target,
    open,
    onOpenChange,
    onSuccess,
    targetType = 'message',
}: RetweetDialogProps) {
    const { data: session } = useSession()
    const [content, setContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [templates, setTemplates] = useState<Template[]>([])
    const mediaUploaderRef = useRef<MediaUploaderRef>(null)

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

    // Reset content when dialog opens
    useEffect(() => {
        if (open) {
            setContent("")
            setUploadedMedia([])
        }
    }, [open])

    if (!target) return null

    const handleRetweet = async () => {
        if (isSubmitting) return

        setIsSubmitting(true)
        try {
            // 1. 创建一条新的主消息，根据 targetType 使用不同的引用字段
            const createData: { content: string; quotedMessageId?: string; quotedCommentId?: string; media?: Array<{ url: string; type: string }> } = {
                content: content.trim(),
                media: uploadedMedia.map(m => ({ url: m.url, type: m.type })),
            }

            if (targetType === 'message') {
                createData.quotedMessageId = target.id
            } else {
                createData.quotedCommentId = target.id
            }

            const result = await messagesApi.createMessage(createData)

            if (result.data) {
                // 2. 调用转发 API 来增加原消息/评论的转发计数
                if (targetType === 'message') {
                    await messagesApi.toggleRetweet(target.id)
                } else {
                    await commentsApi.toggleRetweet(target.id)
                }

                setContent("")
                setUploadedMedia([])
                onOpenChange(false)
                onSuccess?.()
            }
        } catch (error) {
            console.error("Failed to post retweet:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const applyTemplate = (template: Template) => {
        setContent(prev => prev + template.content)
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
                    <DialogTitle className="sr-only">转发</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" className="text-primary font-bold hover:bg-transparent">草稿</Button>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex gap-3 mb-4">
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
                            <div className="mt-1 text-sm leading-normal text-muted-foreground line-clamp-3">
                                <TipTapViewer content={target.content} />
                            </div>
                            {/* Media Display - grid layout */}
                            {target.medias && target.medias.length > 0 && (() => {
                                const mediaCount = target.medias.length
                                return (
                                    <div className={cn(
                                        "mt-2 grid gap-1 rounded-lg overflow-hidden",
                                        mediaCount === 1 && "grid-cols-1",
                                        mediaCount === 2 && "grid-cols-2",
                                        mediaCount === 3 && "grid-cols-2",
                                        mediaCount === 4 && "grid-cols-2"
                                    )}>
                                        {target.medias.map((media, index) => (
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
                                                        className="w-full h-full"
                                                    />
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={session?.user?.image || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {session?.user?.name?.slice(0, 2) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex flex-col min-w-0 gap-2">
                            <Textarea
                                placeholder="添加评论（可选）"
                                className="min-h-[120px] w-full bg-transparent border-none focus-visible:ring-0 text-lg p-0 resize-none placeholder:text-muted-foreground"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                autoFocus
                            />
                            <MediaUploader
                                ref={mediaUploaderRef}
                                media={uploadedMedia}
                                onMediaChange={setUploadedMedia}
                                disabled={isSubmitting}
                                onUploadingChange={setIsUploading}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t">
                    <ActionButtons
                        templates={templates}
                        onApplyTemplate={applyTemplate}
                        onSubmit={handleRetweet}
                        submitDisabled={isSubmitting}
                        isSubmitting={isSubmitting}
                        submitText="转发"
                        hasContent={!!content.trim()}
                        hasMedia={uploadedMedia.length > 0}
                        onImageUpload={() => mediaUploaderRef.current?.triggerUpload()}
                        imageUploading={isUploading}
                        size="sm"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
