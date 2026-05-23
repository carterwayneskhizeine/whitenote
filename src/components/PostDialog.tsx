"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { messagesApi, aiApi } from "@/lib/api"
import { X } from "lucide-react"
import { useSession } from "next-auth/react"
import { cn, getAvatarUrl, isDefaultAvatar } from "@/lib/utils"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { ActionButtons } from "@/components/ActionButtons"
import { SimpleTipTapEditor } from "@/components/SimpleTipTapEditor"
import { templatesApi } from "@/lib/api/templates"
import { Template } from "@/types/api"
import { useState, useEffect, useRef } from "react"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"

interface PostDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function PostDialog({
    open,
    onOpenChange,
    onSuccess,
}: PostDialogProps) {
    const { data: session } = useSession()
    const [content, setContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [templates, setTemplates] = useState<Template[]>([])
    const [isProcessingAI, setIsProcessingAI] = useState(false)
    const mediaUploaderRef = useRef<MediaUploaderRef>(null)
    const wasOpen = useRef(false)
    const { currentWorkspaceId } = useWorkspaceStore()

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
        if (open && !wasOpen.current) {
            setContent("")
            setUploadedMedia([])
        }
        wasOpen.current = open
    }, [open])

    // Sanitize markdown to prevent TipTap mark conflicts
    const sanitizeMarkdown = (markdown: string): string => {
        // Remove bold from within code blocks (e.g., **`code`** -> `code`)
        let sanitized = markdown.replace(/\*\*`([^`]+)`\*\*/g, '`$1`')
        // Remove italic from within code blocks (e.g., *`code`* -> `code`)
        sanitized = sanitized.replace(/\*`([^`]+)`\*/g, '`$1`')
        // Remove bold/italic from within inline code (e.g., `**bold**` -> `bold`)
        sanitized = sanitized.replace(/`(\*\*[^*]+\*\*)`/g, '$1')
        sanitized = sanitized.replace(/`(\*[^*]+\*)`/g, '$1')
        return sanitized
    }

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
                const result = sanitizeMarkdown(data.data.result.trim())
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

    const handlePost = async () => {
        if ((!content.trim() && uploadedMedia.length === 0) || isSubmitting) return

        setIsSubmitting(true)
        try {
            const result = await messagesApi.createMessage({
                content: content.trim(),
                media: uploadedMedia.map(m => ({ url: m.url, type: m.type })),
                workspaceId: currentWorkspaceId || undefined,
            })

            if (result.data) {
                // Check if content contains @goldierill and trigger AI reply
                if (content.includes('@goldierill')) {
                    try {
                        const question = content.replace('@goldierill', '').trim()
                        await aiApi.chat({
                            messageId: result.data.id,
                            content: question || '请回复这条帖子',
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
            console.error("Failed to create post:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const userName = session?.user?.name || "User Name"
    const userAvatar = getAvatarUrl(session?.user?.name || null, session?.user?.image || null) || ""
    const userInitials = userName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "CN"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-[600px] p-0 gap-0 border-none bg-background overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="px-4 py-2 border-b">
                    <DialogTitle className="sr-only">发布新帖子</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                            {userAvatar && <AvatarImage src={userAvatar} className={cn("object-cover", isDefaultAvatar(userAvatar) && "invert dark:invert-0")} />}
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                {userInitials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex flex-col min-w-0 gap-2">
                            <div className="flex items-center gap-1 text-sm">
                                <span className="font-bold text-foreground">
                                    {userName}
                                </span>
                            </div>
                            <SimpleTipTapEditor
                                value={content}
                                onChange={setContent}
                                placeholder="有什么新鲜事？"
                                disabled={isSubmitting}
                                isProcessingAI={isProcessingAI}
                                onTemplateSelect={handleTemplateSelect}
                                minHeight="200px"
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
                        onSubmit={handlePost}
                        submitDisabled={!content.trim() && uploadedMedia.length === 0}
                        isSubmitting={isSubmitting}
                        submitText="发布"
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
