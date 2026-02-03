"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Message } from "@/lib/api/messages"
import { Button } from "@/components/ui/button"
import { Link2, Loader2, ArrowLeft, Share2, Calendar, Copy, Check } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { TipTapViewer } from "@/components/TipTapViewer"
import { MediaGrid } from "@/components/MediaGrid"
import { Separator } from "@/components/ui/separator"
import { cn, getHandle } from "@/lib/utils"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { ImageLightbox } from "@/components/ImageLightbox"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { Badge } from "@/components/ui/badge"
import { PublicCommentsList } from "@/components/PublicCommentsList"

export default function SharePage() {
    const { id } = useParams() as { id: string }
    const router = useRouter()
    const [message, setMessage] = useState<Message | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [contentCopied, setContentCopied] = useState(false)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [markdownImages, setMarkdownImages] = useState<string[]>([])
    const [isExpanded, setIsExpanded] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const fetchMessage = async () => {
            try {
                // 使用公开 API 端点，不需要认证
                const response = await fetch(`/api/public/messages/${id}`)

                if (response.ok) {
                    const result = await response.json()
                    setMessage(result.data)
                } else if (response.status === 404) {
                    setError("帖子不存在")
                } else {
                    setError("加载失败")
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
    }, [message?.content])

    // Extract markdown images from content
    useEffect(() => {
        if (!message?.content) return
        // 使用 Set 去重，确保相同的 URL 只出现一次
        const images = Array.from(new Set(
            message.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
                const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
                return url || ''
            }).filter(url => url && !url.startsWith('data:')) || []
        ))
        setMarkdownImages(images)
    }, [message?.content])

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
        if (!message) return
        try {
            // 构建完整内容，包括作者信息、时间、标签和正文
            const authorName = message.author?.name || "GoldieRill"
            const authorHandle = getHandle(message.author?.email || null, !!message.author)
            const time = format(new Date(message.createdAt), "yyyy'年'M'月'd'日' HH:mm", { locale: zhCN })
            const tags = message.tags.length > 0
                ? '\n' + message.tags.map(({ tag }) => `#${tag.name}`).join(' ')
                : ''

            const fullContent = `${authorName} (@${authorHandle})\n${time}${tags}\n\n${message.content}`

            await navigator.clipboard.writeText(fullContent)
            setContentCopied(true)
            setTimeout(() => setContentCopied(false), 2000)
        } catch (error) {
            console.error("Failed to copy content:", error)
        }
    }

    const handleImageClick = (index: number, e: React.MouseEvent) => {
        e.stopPropagation()
        setLightboxIndex(index)
        setLightboxOpen(true)
    }

    const handleMarkdownImageClick = (index: number, url: string) => {
        const mediaCount = message?.medias?.length || 0
        setLightboxIndex(mediaCount + index)
        setLightboxOpen(true)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !message) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center p-8 max-w-md">
                    <div className="text-6xl mb-4">📝</div>
                    <h1 className="text-2xl font-bold mb-2">帖子不存在</h1>
                    <p className="text-muted-foreground mb-6">
                        {error || "该帖子可能已被删除或链接不正确"}
                    </p>
                    <Button onClick={() => router.push('/')} variant="default">
                        返回首页
                    </Button>
                </div>
            </div>
        )
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
                            onClick={() => router.push('/')}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Share2 className="h-5 w-5 text-primary" />
                            <h1 className="text-lg font-bold">分享帖子</h1>
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
                {/* Message Card */}
                <div className="p-6">
                    {/* Author Info */}
                    <div className="flex items-start gap-4 mb-6">
                        <div className="shrink-0">
                            <GoldieAvatar
                                name={message.author?.name || null}
                                avatar={message.author?.avatar || null}
                                size="lg"
                                isAI={!message.author}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-bold text-lg">
                                    {message.author?.name || "GoldieRill"}
                                </span>
                                <span className="text-muted-foreground">
                                    @{getHandle(message.author?.email || null, !!message.author)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <time>
                                    {format(new Date(message.createdAt), "yyyy'年'M'月'd'日' HH:mm", { locale: zhCN })}
                                </time>
                                {message.updatedAt && new Date(message.updatedAt).getTime() > new Date(message.createdAt).getTime() + 1000 && (
                                    <span>· 已编辑</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tags */}
                    {message.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {message.tags.map(({ tag }) => (
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
                        <TipTapViewer content={message.content} onImageClick={handleMarkdownImageClick} />
                    </div>

                    {hasMore && !isExpanded && (
                        <button
                            ref={buttonRef}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()

                                // Store viewport position before expansion
                                const currentScrollY = window.scrollY
                                const buttonRect = buttonRef.current?.getBoundingClientRect()
                                if (!buttonRect) {
                                    setIsExpanded(true)
                                    return
                                }

                                // The button's position relative to viewport
                                const buttonBottom = buttonRect.bottom

                                // Expand the content
                                setIsExpanded(true)

                                // After expansion, scroll to maintain the button's original position in viewport
                                requestAnimationFrame(() => {
                                    const targetScrollY = Math.max(0, currentScrollY + buttonBottom - window.innerHeight * 0.7)
                                    window.scrollTo({
                                        top: targetScrollY,
                                        behavior: 'instant'
                                    })
                                })
                            }}
                            className="text-primary text-sm font-medium mb-4 hover:underline flex items-center gap-1"
                        >
                            显示更多
                        </button>
                    )}

                    {/* Media */}
                    <MediaGrid
                        medias={message.medias || []}
                        onImageClick={handleImageClick}
                        className="mb-4"
                    />

                    {/* Quoted Message */}
                    {(message.quotedMessage || message.quotedComment) && (
                        <div className="mb-4">
                            <QuotedMessageCard message={message.quotedMessage || message.quotedComment!} />
                        </div>
                    )}

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">{message._count.comments}</span>
                                <span>条评论</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">{message.retweetCount ?? 0}</span>
                                <span>次转发</span>
                            </div>
                        </div>
                        <div className="text-xs">
                            WhiteNote
                        </div>
                    </div>
                </div>

                {/* Comments Section */}
                <PublicCommentsList
                    messageId={id}
                    authorCommentSortOrder={message?.authorCommentSortOrder}
                />
            </div>

            {/* Image Lightbox */}
            <ImageLightbox
                media={[
                    ...(message?.medias || []),
                    ...markdownImages.map(url => ({ url, type: 'image' }))
                ]}
                initialIndex={lightboxIndex}
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
            />
        </div>
    )
}
