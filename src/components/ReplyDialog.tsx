"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { commentsApi, aiApi } from "@/lib/api"
import { X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useSession } from "next-auth/react"
import { TipTapViewer } from "@/components/TipTapViewer"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { getHandle } from "@/lib/utils"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { ActionButtons } from "@/components/ActionButtons"
import { SimpleTipTapEditor } from "@/components/SimpleTipTapEditor"
import { templatesApi } from "@/lib/api/templates"
import { Template } from "@/types/api"
import { useState, useEffect, useRef } from "react"

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
    const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [templates, setTemplates] = useState<Template[]>([])
    const [isProcessingAI, setIsProcessingAI] = useState(false)
    const mediaUploaderRef = useRef<MediaUploaderRef>(null)
    const wasOpen = useRef(false)

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

    // Reset content and media only when dialog opens (transition from closed to open)
    useEffect(() => {
        if (open && !wasOpen.current && target) {
            setContent("")
            setUploadedMedia([])
        }
        wasOpen.current = open
    }, [open, target])

    if (!target) return null

    // Handle AI command selection from button
    const handleAICommandFromButton = async (action: string) => {
        setIsProcessingAI(true)
        try {
            const response = await fetch('/api/ai/enhance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    content: content.trim(),
                }),
            })

            if (!response.ok) throw new Error('AI request failed')

            const data = await response.json()
            if (data.data?.result) {
                const result = data.data.result.trim()
                setContent(result)
            }
        } catch (error) {
            console.error('AI enhance error:', error)
        } finally {
            setIsProcessingAI(false)
        }
    }

    // Handle template selection from "/" command
    const handleTemplateSelect = (template: Template, editor: any) => {
        if (!editor) return
        const currentContent = editor.getMarkdown()
        const newContent = currentContent + (currentContent ? "\n" : "") + template.content
        editor.commands.setContent(newContent, {
            contentType: 'markdown',
            parseOptions: {
                preserveWhitespace: 'full',
            },
        })
    }

    const handleReply = async () => {
        if ((!content.trim() && uploadedMedia.length === 0) || isSubmitting) return

        setIsSubmitting(true)
        try {
            // Determine parentId: if target.id is not messageId, it's a comment reply
            const parentId = target.id !== messageId ? target.id : undefined

            const result = await commentsApi.createComment({
                content: content.trim(),
                messageId: messageId,
                parentId: parentId,
                media: uploadedMedia.map(m => ({ url: m.url, type: m.type })),
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
                setUploadedMedia([])
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
            <DialogContent showCloseButton={false} className="sm:max-w-[600px] p-0 gap-0 border-none bg-background overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="px-4 py-2 border-b">
                    <DialogTitle className="sr-only">回复</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
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
                            <div className="mt-1 text-sm leading-normal line-clamp-2">
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
                        <div className="flex-1 flex flex-col min-w-0 gap-2">
                            <SimpleTipTapEditor
                                value={content}
                                onChange={setContent}
                                placeholder="发布你的回复"
                                disabled={isSubmitting}
                                isProcessingAI={isProcessingAI}
                                onTemplateSelect={handleTemplateSelect}
                                minHeight="120px"
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
                        onAICommandSelect={handleAICommandFromButton}
                        onSubmit={handleReply}
                        submitDisabled={!content.trim() && uploadedMedia.length === 0}
                        isSubmitting={isSubmitting}
                        submitText="回复"
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
