"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Link2, Loader2, ArrowLeft, Share2, MessageCircle, Bot, Copy, Check } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { TipTapViewer } from "@/components/TipTapViewer"
import { MediaGrid } from "@/components/MediaGrid"
import { Separator } from "@/components/ui/separator"
import { cn, getHandle } from "@/lib/utils"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { ImageLightbox } from "@/components/ImageLightbox"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { Badge } from "@/components/ui/badge"
import { CommentItem } from "@/components/CommentItem"

interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string | null
  isAIBot: boolean
  parentId: string | null
  tags: Array<{ tag: { id: string; name: string; color: string | null } }>
  medias: Array<{ id: string; url: string; type: string; description: string | null }>
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  } | null
  quotedMessage: any
  message: {
    id: string
    content: string
  }
}

export default function CommentSharePage() {
    const { id } = useParams() as { id: string }
    const router = useRouter()
    const [comment, setComment] = useState<Comment | null>(null)
    const [childComments, setChildComments] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [childrenLoading, setChildrenLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [contentCopied, setContentCopied] = useState(false)
    const [copiedChildId, setCopiedChildId] = useState<string | null>(null)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [markdownImages, setMarkdownImages] = useState<string[]>([])
    const [currentMedias, setCurrentMedias] = useState<any[]>([])
    const [isExpanded, setIsExpanded] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const fetchComment = async () => {
            try {
                // 使用公开 API 端点，不需要认证
                const response = await fetch(`/api/public/comments/${id}`)

                if (response.ok) {
                    const result = await response.json()
                    setComment(result.data)
                } else if (response.status === 404) {
                    setError("评论不存在")
                } else {
                    setError("加载失败")
                }
            } catch (err) {
                console.error("Failed to fetch comment:", err)
                setError("Failed to load comment")
            } finally {
                setIsLoading(false)
            }
        }

        const fetchChildComments = async () => {
            setChildrenLoading(true)
            try {
                const response = await fetch(`/api/public/comments/${id}/children`)
                if (response.ok) {
                    const result = await response.json()
                    setChildComments(result.data)
                }
            } catch (err) {
                console.error("Failed to fetch child comments:", err)
            } finally {
                setChildrenLoading(false)
            }
        }

        if (id) {
            fetchComment()
            fetchChildComments()
        }
    }, [id])

    // 检测内容是否需要"显示更多"按钮
    useEffect(() => {
        const checkOverflow = () => {
            if (contentRef.current) {
                const el = contentRef.current
                setHasMore(el.scrollHeight > el.clientHeight)
            }
        }

        const timer1 = setTimeout(checkOverflow, 100)
        const timer2 = setTimeout(checkOverflow, 300)

        return () => {
            clearTimeout(timer1)
            clearTimeout(timer2)
        }
    }, [comment?.content])

    // Extract markdown images from content
    useEffect(() => {
        if (!comment?.content) return
        // 使用 Set 去重，确保相同的 URL 只出现一次
        const images = Array.from(new Set(
            comment.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
                const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
                return url || ''
            }).filter(url => url && !url.startsWith('data:')) || []
        ))
        setMarkdownImages(images)
    }, [comment?.content])

    // Initialize currentMedias when comment loads
    useEffect(() => {
        if (comment?.medias) {
            setCurrentMedias(comment.medias)
        }
    }, [comment?.medias])

    const handleCopyLink = async () => {
        try {
            const shareUrl = window.location.href
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error("Failed to copy link:", error)
        }
    }

    const handleCopyContent = async () => {
        if (!comment) return
        try {
            const authorName = comment.author?.name || "GoldieRill"
            const authorHandle = getHandle(comment.author?.email || null, !!comment.author)
            const time = formatTime(comment.createdAt)
            const tags = comment.tags.length > 0
                ? '\n' + comment.tags.map(({ tag }) => `#${tag.name}`).join(' ')
                : ''

            const fullContent = `${authorName} (@${authorHandle})\n${time}${tags}\n\n${comment.content}`

            await navigator.clipboard.writeText(fullContent)
            setContentCopied(true)
            setTimeout(() => setContentCopied(false), 2000)
        } catch (error) {
            console.error("Failed to copy content:", error)
        }
    }

    const handleImageClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation()
        setCurrentMedias(comment?.medias || [])
        setLightboxIndex(index)
        setLightboxOpen(true)
    }

    const handleMarkdownImageClick = (index: number, url: string) => {
        const mediaCount = comment?.medias?.length || 0

        // 去重：提取 comment.medias 中的 URL 集合
        const mediaUrls = new Set(comment?.medias?.map(m => m.url) || [])

        // 过滤掉 markdownImages 中与 comment.medias 重复的图片
        const uniqueMarkdownImages = markdownImages.filter(img => !mediaUrls.has(img))

        setCurrentMedias([
            ...(comment?.medias || []),
            ...uniqueMarkdownImages.map(img => ({ url: img, type: 'image' as const, id: img }))
        ])
        setLightboxIndex(mediaCount + index)
        setLightboxOpen(true)
    }

    const handleCopyChildComment = async (childComment: any, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await navigator.clipboard.writeText(childComment.content)
            setCopiedChildId(childComment.id)
            setTimeout(() => setCopiedChildId(null), 1000)
        } catch (error) {
            console.error("Failed to copy comment:", error)
        }
    }

    const handleShareChildComment = (childId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        router.push(`/share/comment/${childId}`)
    }

    // Handle image click for child comments
    const handleImageClickForChild = (index: number, medias: any, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!medias || medias.length === 0) return

        // Extract markdown images from the child comment's content
        const childComment = childComments.find(c => c.medias === medias)
        // 使用 Set 去重，确保相同的 URL 只出现一次
        const mdImages = Array.from(new Set(
            childComment?.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
                const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
                return url || ''
            }).filter(url => url && !url.startsWith('data:')) || []
        ))

        setCurrentMedias(medias)
        setMarkdownImages(mdImages)
        setLightboxIndex(index)
        setLightboxOpen(true)
    }

    // Handle markdown image click for child comments
    const handleMarkdownImageClickForChild = (childComment: any, index: number, url: string) => {
        // 使用 Set 去重，确保相同的 URL 只出现一次
        const mdImages = Array.from(new Set(
            childComment.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
                const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
                return url || ''
            }).filter(url => url && !url.startsWith('data:')) || []
        ))

        // 去重：提取 childComment.medias 中的 URL 集合
        const mediaUrls = new Set(childComment.medias?.map(m => m.url) || [])

        // 过滤掉 markdownImages 中与 childComment.medias 重复的图片
        const uniqueMarkdownImages = mdImages.filter(url => !mediaUrls.has(url))

        setCurrentMedias(childComment.medias || [])
        setMarkdownImages(uniqueMarkdownImages)
        setLightboxIndex((childComment.medias?.length || 0) + index)
        setLightboxOpen(true)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !comment) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center p-8 max-w-md">
                    <div className="text-6xl mb-4">💬</div>
                    <h1 className="text-2xl font-bold mb-2">评论不存在</h1>
                    <p className="text-muted-foreground mb-6">
                        {error || "该评论可能已被删除或链接不正确"}
                    </p>
                    <Button onClick={() => router.push('/')}>
                        返回首页
                    </Button>
                </div>
            </div>
        )
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

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-9 w-9"
                            onClick={() => {
                                // 如果有父评论，返回到父评论；否则返回到消息
                                if (comment.parentId) {
                                    router.push(`/share/comment/${comment.parentId}`)
                                } else {
                                    router.push(`/share/${comment.message.id}`)
                                }
                            }}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-primary" />
                            <h1 className="text-lg font-bold">分享评论</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={copied ? "default" : "outline"}
                            size="icon"
                            className="rounded-full h-9 w-9"
                            onClick={handleCopyLink}
                        >
                            <Link2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={contentCopied ? "default" : "outline"}
                            size="icon"
                            className="rounded-full h-9 w-9"
                            onClick={handleCopyContent}
                        >
                            {contentCopied ? (
                                <Check className="h-4 w-4" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-3xl mx-auto">
                {/* Comment Card */}
                <div className="p-6">
                    {/* Author Info */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className="shrink-0">
                            <GoldieAvatar
                                name={comment.author?.name || null}
                                avatar={comment.author?.avatar || null}
                                size="lg"
                                isAI={!comment.author}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-bold text-lg">
                                    {comment.author?.name || "GoldieRill"}
                                </span>
                                <span className="text-muted-foreground">
                                    @{getHandle(comment.author?.email || null, !!comment.author)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <span>{formatTime(comment.createdAt)}</span>
                                {comment.updatedAt && new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime() + 1000 && (
                                    <span>· 已编辑</span>
                                )}
                                {comment.isAIBot && <Bot className="h-3.5 w-3.5 text-primary" />}
                            </div>
                        </div>
                    </div>

                    {/* Tags */}
                    {comment.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {comment.tags.map(({ tag }) => (
                                <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-sm font-normal px-2.5 py-0.5"
                                >
                                    #{tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Content */}
                    <div
                        ref={contentRef}
                        className={cn(
                            "text-base leading-relaxed wrap-break-word text-foreground mb-4 overflow-hidden",
                            !isExpanded && "line-clamp-12"
                        )}
                        style={!isExpanded ? {
                            display: '-webkit-box',
                            WebkitLineClamp: 12,
                            WebkitBoxOrient: 'vertical',
                        } : {}}
                    >
                        <TipTapViewer content={comment.content} onImageClick={handleMarkdownImageClick} />
                    </div>
                    {hasMore && !isExpanded && (
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-primary text-sm font-medium mb-4 hover:underline flex items-center gap-1"
                        >
                            显示更多
                        </button>
                    )}

                    {/* Media */}
                    <MediaGrid
                        medias={comment.medias || []}
                        onImageClick={handleImageClick}
                        className="mb-4"
                    />

                    {/* Quoted Message */}
                    {comment.quotedMessage && (
                        <div className="mb-4">
                            <QuotedMessageCard message={comment.quotedMessage} />
                        </div>
                    )}
                </div>

                {/* Child Comments */}
                {childComments.length > 0 && (
                    <>
                        <Separator />
                        <div className="px-6 py-4 bg-muted/30">
                            <div className="font-bold text-sm">回复 ({childComments.length})</div>
                        </div>
                        <div className="flex flex-col">
                            {childComments.map(child => (
                                <CommentItem
                                    key={child.id}
                                    comment={child}
                                    onClick={() => router.push(`/share/comment/${child.id}`)}
                                    showMenu={false}
                                    onReply={undefined}
                                    onRetweet={undefined}
                                    onToggleStar={undefined}
                                    copied={copiedChildId === child.id}
                                    onCopy={(e) => handleCopyChildComment(child, e)}
                                    onShare={(e) => handleShareChildComment(child.id, e)}
                                    onImageClick={(index, e) => handleImageClickForChild(index, child.medias, e)}
                                    onMarkdownImageClick={(index, url) => handleMarkdownImageClickForChild(child, index, url)}
                                    replyCount={child._count?.replies || 0}
                                    retweetCount={child.retweetCount ?? 0}
                                    size="sm"
                                    actionRowSize="sm"
                                />
                            ))}
                        </div>
                    </>
                )}
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
