"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { commentsApi, aiApi, templatesApi } from "@/lib/api"
import { Comment } from "@/types/api"
import { Template } from "@/types/api"
import { TipTapViewer } from "@/components/TipTapViewer"
import { MediaGrid } from "@/components/MediaGrid"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { SimpleTipTapEditor } from "@/components/SimpleTipTapEditor"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { ActionButtons } from "@/components/ActionButtons"
import { getHandle } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

export default function MobileCommentReplyPage() {
  const { id, commentId } = useParams() as { id: string; commentId: string }
  const router = useRouter()
  const [comment, setComment] = useState<Comment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(0)
  const mediaUploaderRef = useRef<MediaUploaderRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle Visual Viewport API for keyboard
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
      }
    }

    // Initial set
    handleResize()

    // Listen to viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  // Fetch comment and templates
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [commentResult, templateResult] = await Promise.all([
          commentsApi.getComment(commentId),
          templatesApi.getTemplates()
        ])
        if (commentResult.data) {
          setComment(commentResult.data)
        } else {
          setError(commentResult.error || "Comment not found")
        }
        if (templateResult.data) {
          setTemplates(templateResult.data)
        }
      } catch (err) {
        console.error("Failed to fetch data:", err)
        setError("Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }
    if (commentId) {
      fetchData()
    }
  }, [commentId])

  // Handle AI command selection
  const handleAICommand = async (action: string, editor: any) => {
    if (!editor || isProcessingAI) return

    const currentContent = editor.getMarkdown().trim()
    if (!currentContent) return

    setIsProcessingAI(true)
    try {
      const response = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          content: currentContent,
        }),
      })

      if (!response.ok) throw new Error('AI request failed')

      const data = await response.json()
      if (data.data?.result) {
        const result = data.data.result.trim()
        if (!result) {
          editor.commands.clearContent()
        } else {
          editor.commands.setContent(result, {
            contentType: 'markdown',
            parseOptions: {
              preserveWhitespace: 'full',
            },
          })
        }
      }
    } catch (error) {
      console.error('AI enhance error:', error)
    } finally {
      setIsProcessingAI(false)
    }
  }

  const handleReply = async () => {
    if ((!content.trim() && uploadedMedia.length === 0) || isSubmitting || !comment) return

    setIsSubmitting(true)
    try {
      const result = await commentsApi.createComment({
        content: content.trim(),
        messageId: id,
        parentId: commentId,
        media: uploadedMedia.map(m => ({ url: m.url, type: m.type })),
      })

      if (result.data) {
        // Check if comment contains @goldierill and trigger AI reply
        if (content.includes('@goldierill')) {
          try {
            const question = content.replace('@goldierill', '').trim()
            await aiApi.chat({
              messageId: id,
              content: question || '请回复这条评论',
            })
          } catch (aiError) {
            console.error("Failed to get AI reply:", aiError)
          }
        }

        // Navigate back to the comment detail page
        router.push(`/status/${id}/comment/${commentId}`)
      }
    } catch (error) {
      console.error("Failed to post reply:", error)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !comment) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">{error || "Comment not found"}</p>
        <Button onClick={() => router.back()}>返回</Button>
      </div>
    )
  }

  const targetHandle = getHandle(comment.author?.email || null, !!comment.author)

  return (
    <div
      ref={containerRef}
      className="flex flex-col"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100vh', overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3 shrink-0 z-50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">回复</h1>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Original Comment Preview */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-3">
            <GoldieAvatar
              name={comment.author?.name || null}
              avatar={comment.author?.avatar || null}
              size="md"
              isAI={!comment.author}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-sm">
                <span className="font-bold text-foreground">
                  {comment.author?.name || "GoldieRill"}
                </span>
                <span className="text-muted-foreground truncate">
                  @{targetHandle}
                </span>
                <span className="text-muted-foreground px-1">·</span>
                <span className="text-muted-foreground">
                  {formatTime(comment.createdAt)}
                </span>
              </div>
              <div className="mt-1 text-sm leading-normal line-clamp-3">
                <TipTapViewer content={comment.content} />
              </div>
              {comment.medias && comment.medias.length > 0 && (
                <MediaGrid medias={comment.medias} className="mt-2" />
              )}
            </div>
          </div>
        </div>

        {/* Reply Input Area */}
        <div className="p-4 pb-safe-or-4">
          <SimpleTipTapEditor
            value={content}
            onChange={setContent}
            placeholder="发布你的回复"
            disabled={isSubmitting}
            isProcessingAI={isProcessingAI}
            onAICommandSelect={handleAICommand}
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

      {/* Action Buttons - Fixed at bottom */}
      <div className="p-4 border-t bg-background shrink-0 pb-safe-or-4 z-50">
        <ActionButtons
          templates={templates}
          onApplyTemplate={applyTemplate}
          onSubmit={handleReply}
          submitDisabled={!content.trim() && uploadedMedia.length === 0}
          isSubmitting={isSubmitting}
          submitText="回复"
          hasContent={!!content.trim()}
          hasMedia={uploadedMedia.length > 0}
          onImageUpload={() => mediaUploaderRef.current?.triggerUpload()}
          imageUploading={isUploading}
        />
      </div>
    </div>
  )
}
