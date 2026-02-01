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
import { ImageLightbox } from "@/components/ImageLightbox"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { SimpleTipTapEditor } from "@/components/SimpleTipTapEditor"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { ActionButtons } from "@/components/ActionButtons"
import { getHandle } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { detectAIMention } from "@/lib/utils/ai-detection"

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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [markdownImages, setMarkdownImages] = useState<string[]>([])

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

  // Extract markdown images from content
  useEffect(() => {
    if (comment?.content) {
      // 使用 Set 去重，确保相同的 URL 只出现一次
      const images = Array.from(new Set(
        comment.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
          const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
          return url || ''
        }).filter(url => url && !url.startsWith('data:')) || []
      ))
      setMarkdownImages(images)
    }
  }, [comment?.content])

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

  const handleMarkdownImageClick = (index: number, url: string) => {
    const mediaCount = comment?.medias?.length || 0
    setLightboxIndex(mediaCount + index)
    setLightboxOpen(true)
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
        // Check if comment contains AI mentions and trigger AI reply
        const aiDetection = detectAIMention(content)

        if (aiDetection.hasMention && aiDetection.mode) {
          try {
            await aiApi.chat({
              messageId: id,
              content: aiDetection.cleanedContent || '请回复这条评论',
              mode: aiDetection.mode,
            })
          } catch (aiError) {
            console.error("Failed to get AI reply:", aiError)
            alert(`AI 回复失败: ${aiError instanceof Error ? aiError.message : '未知错误'}`)
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
                <TipTapViewer content={comment.content} onImageClick={handleMarkdownImageClick} />
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

      {/* Action Buttons - Fixed at bottom */}
      <div className="p-4 border-t bg-background shrink-0 pb-safe-or-4 z-50">
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
        />
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        media={(() => {
          // 去重：提取 comment.medias 中的 URL 集合
          const mediaUrls = new Set(comment?.medias?.map(m => m.url) || [])

          // 过滤掉 markdownImages 中与 comment.medias 重复的图片
          const uniqueMarkdownImages = markdownImages.filter(url => !mediaUrls.has(url))

          return [
            ...(comment?.medias || []),
            ...uniqueMarkdownImages.map(url => ({ url, type: 'image' as const }))
          ]
        })()}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  )
}
