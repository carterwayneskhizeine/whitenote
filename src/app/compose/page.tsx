"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Loader2 } from "lucide-react"
import { cn, getAvatarUrl, isDefaultAvatar } from "@/lib/utils"
import { SimpleTipTapEditor } from "@/components/SimpleTipTapEditor"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { ActionButtons } from "@/components/ActionButtons"
import { messagesApi, aiApi } from "@/lib/api"
import { templatesApi } from "@/lib/api/templates"
import { Template } from "@/types/api"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"

export default function ComposePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { currentWorkspaceId } = useWorkspaceStore()

  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const mediaUploaderRef = useRef<MediaUploaderRef>(null)

  // Handle visual viewport changes (keyboard show/hide on mobile)
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height
        const windowHeight = window.innerHeight
        // If viewport is smaller than window, keyboard is likely showing
        const keyboardOffset = windowHeight - viewportHeight
        setKeyboardHeight(keyboardOffset > 150 ? keyboardOffset : 0)
      }
    }

    window.visualViewport?.addEventListener('resize', handleViewportResize)
    // Initial check
    handleViewportResize()

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize)
    }
  }, [])

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

  // Sanitize markdown to prevent TipTap mark conflicts
  const sanitizeMarkdown = (markdown: string): string => {
    let sanitized = markdown.replace(/\*\*`([^`]+)`\*\*/g, '`$1`')
    sanitized = sanitized.replace(/\*`([^`]+)`\*/g, '`$1`')
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

        // Navigate to the new message
        router.replace(`/status/${result.data.id}`)
      }
    } catch (error) {
      console.error("Failed to create post:", error)
      alert("发布失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (content.trim() || uploadedMedia.length > 0) {
      if (confirm("确定要放弃编辑吗？")) {
        router.back()
      }
    } else {
      router.back()
    }
  }

  const userName = session?.user?.name || "User Name"
  const userAvatar = getAvatarUrl(session?.user?.name || null, session?.user?.image || null) || ""
  const userInitials = userName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "CN"

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleCancel}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">发布新帖子</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCancel}
            disabled={isSubmitting}
            variant="ghost"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            取消
          </Button>
          <Button
            onClick={handlePost}
            disabled={isSubmitting || (!content.trim() && uploadedMedia.length === 0)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                发布中
              </>
            ) : "发布"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-3 p-4">
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
              minHeight="300px"
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

      {/* Bottom Action Bar */}
      <div
        className="border-t border-border bg-background/95 backdrop-blur p-4 transition-all duration-300 fixed bottom-0 left-0 right-0 z-50"
        style={{
          transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)',
        }}
      >
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
          showSubmitButton={false}
        />
      </div>
    </div>
  )
}
