"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { CommentItem } from "@/components/CommentItem"
import { ImageLightbox } from "@/components/ImageLightbox"

interface PublicCommentsListProps {
  messageId: string
  authorCommentSortOrder?: boolean
}

export function PublicCommentsList({ messageId, authorCommentSortOrder }: PublicCommentsListProps) {
  const router = useRouter()
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [currentMedias, setCurrentMedias] = useState<any[]>([])
  const [markdownImages, setMarkdownImages] = useState<string[]>([])

  useEffect(() => {
    const fetchComments = async () => {
      try {
        // API 已使用硬编码排序，无需传递参数
        const response = await fetch(`/api/public/messages/${messageId}/comments`)
        if (response.ok) {
          const result = await response.json()
          setComments(result.data)
        } else {
          setError("加载评论失败")
        }
      } catch (err) {
        console.error("Failed to load comments:", err)
        setError("加载评论失败")
      } finally {
        setLoading(false)
      }
    }
    fetchComments()
  }, [messageId])

  const handleCopy = async (comment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(comment.content)
      setCopiedId(comment.id)
      setTimeout(() => setCopiedId(null), 1000)
    } catch (error) {
      console.error("Failed to copy comment:", error)
    }
  }

  const handleShare = (commentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/share/comment/${commentId}`)
  }

  // Handle image click to open lightbox
  const handleImageClick = (index: number, medias: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!medias || medias.length === 0) return

    // Extract markdown images from the comment's content
    const comment = comments.find(c => c.medias === medias)
    // 使用 Set 去重，确保相同的 URL 只出现一次
    const mdImages = Array.from(new Set(
      comment?.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map((match: string) => {
        const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
        return url || ''
      }).filter((url: string) => url && !url.startsWith('data:')) || []
    ))

    setCurrentMedias(medias)
    setMarkdownImages(mdImages as string[])
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // Handle markdown image click to open lightbox
  const handleMarkdownImageClick = (comment: any, index: number, url: string) => {
    // 使用 Set 去重，确保相同的 URL 只出现一次
    const mdImages = Array.from(new Set(
      comment.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map((match: string) => {
        const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
        return url || ''
      }).filter((url: string) => url && !url.startsWith('data:')) || []
    ))

    // 去重：提取 comment.medias 中的 URL 集合
    const mediaUrls = new Set(comment.medias?.map((m: any) => m.url) || [])

    // 过滤掉 markdownImages 中与 comment.medias 重复的图片
    const uniqueMarkdownImages = (mdImages as string[]).filter((url: string) => !mediaUrls.has(url))

    setCurrentMedias(comment.medias || [])
    setMarkdownImages(uniqueMarkdownImages)
    setLightboxIndex((comment.medias?.length || 0) + index)
    setLightboxOpen(true)
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        {error}
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        暂无评论
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border font-bold">
        评论 ({comments.length})
      </div>

      {/* Comments List */}
      <div className="flex flex-col">
        {comments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onClick={() => router.push(`/share/comment/${comment.id}`)}
            showMenu={false}
            onReply={undefined}
            onRetweet={undefined}
            onToggleStar={undefined}
            copied={copiedId === comment.id}
            onCopy={(e) => handleCopy(comment, e)}
            onShare={(e) => handleShare(comment.id, e)}
            onImageClick={(index, e) => handleImageClick(index, comment.medias, e)}
            onMarkdownImageClick={(index, url) => handleMarkdownImageClick(comment, index, url)}
            replyCount={comment._count?.replies || 0}
            retweetCount={comment.retweetCount ?? 0}
            size="md"
            actionRowSize="sm"
          />
        ))}
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        media={(() => {
          // 去重：提取 currentMedias 中的 URL 集合
          const mediaUrls = new Set(currentMedias?.map(m => m.url) || [])

          // 过滤掉 markdownImages 中与 currentMedias 重复的图片
          const uniqueMarkdownImages = markdownImages.filter(url => !mediaUrls.has(url))

          return [
            ...(currentMedias || []),
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
