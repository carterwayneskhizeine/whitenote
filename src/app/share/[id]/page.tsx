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

    // ── JSON-LD structured data (schema.org/SocialMediaPosting) ──────────────
    // 从 markdown 正文中提取纯文本，去掉代码块、图片、链接语法等噪音，
    // 目的是让外部 AI / 搜索引擎能直接读取可读正文，无需解析 markdown。
    const plainText = message.content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_~]{1,2}([^*_~\n]+)[*_~]{1,2}/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/^\s*>\s*/gm, '')
        .replace(/\n{2,}/g, ' ')
        .trim()

    // headline: 优先取正文第一行，截断到 110 字符
    const headline = plainText.slice(0, 110)

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        "@id": `https://whitenote.goldie-rill.top/share/${message.id}`,
        "url": `https://whitenote.goldie-rill.top/share/${message.id}`,
        "headline": headline,
        "author": {
            "@type": "Person",
            "name": message.author?.name || "GoldieRill",
            "identifier": `@${getHandle(message.author?.email || null, !!message.author)}`,
        },
        "datePublished": new Date(message.createdAt).toISOString(),
        "dateModified": new Date(message.updatedAt).toISOString(),
        "articleBody": plainText,
        // keywords: 现有标签 → 逗号分隔，方便搜索引擎和 AI 提取主题
        "keywords": message.tags.map(({ tag }) => tag.name).join(", ") || undefined,
        "interactionStatistic": [
            {
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/CommentAction",
                "userInteractionCount": message._count.comments,
            },
            {
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/ShareAction",
                "userInteractionCount": message.retweetCount ?? 0,
            },
        ],
    }

    return (
        <div className="min-h-screen bg-background">
            {/*
              JSON-LD 可以放在 <body> 任意位置，Google / AI 爬虫均支持。
              dangerouslySetInnerHTML 内容由服务器可信数据构建，无 XSS 风险。
            */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

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
                            <span className="text-lg font-bold">分享帖子</span>
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

            {/* Main Content
                <main> 让屏幕阅读器 / 爬虫明确识别页面主体区域 */}
            <main className="max-w-3xl mx-auto">
                {/*
                  <article> 标记"一篇独立完整的内容单元"。
                  data-post-id 便于爬虫脚本直接取到帖子 ID，
                  无需解析 URL 或 DOM 层级。
                */}
                <article className="whitenote-post" data-post-id={id}>
                    <div className="p-6">
                        {/*
                          <header> 包裹帖子元信息（作者、时间、标签）。
                          爬虫 / AI 工具通常把 <header> 里的内容识别为
                          "byline"（署名行），自动提取作者和发布时间。
                        */}
                        <header className="post-header">
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
                                        {/* itemprop 属性让 schema.org 微数据也能识别作者姓名 */}
                                        <span className="font-bold text-lg" itemProp="author">
                                            {message.author?.name || "GoldieRill"}
                                        </span>
                                        <span className="text-muted-foreground">
                                            @{getHandle(message.author?.email || null, !!message.author)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {/*
                                          <time dateTime="ISO"> 是机器可读的时间戳。
                                          爬虫和 HTML→Markdown 工具会优先读取 dateTime 属性。
                                        */}
                                        <time dateTime={new Date(message.createdAt).toISOString()}>
                                            {format(new Date(message.createdAt), "yyyy'年'M'月'd'日' HH:mm", { locale: zhCN })}
                                        </time>
                                        {message.updatedAt && new Date(message.updatedAt).getTime() > new Date(message.createdAt).getTime() + 1000 && (
                                            <span>· 已编辑</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tags — rel="tag" 让爬虫识别这是主题标签 */}
                            {message.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4" aria-label="标签">
                                    {message.tags.map(({ tag }) => (
                                        <Badge
                                            key={tag.id}
                                            variant="secondary"
                                            className="text-sm font-normal px-2.5 py-0.5"
                                        >
                                            <span rel="tag">#{tag.name}</span>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </header>

                        {/*
                          <section class="post-content"> 包裹正文区域。
                          内部 TipTap 输出真实语义标签（h1-h6, p, ul/ol/li,
                          blockquote, pre/code），已满足 HTML→Markdown 工具的需求。
                        */}
                        <section className="post-content">
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
                        </section>

                        {/*
                          <section class="post-actions"> 包裹社交互动统计。
                          aria-label 让辅助技术和爬虫知道这是"社交操作区"而非正文，
                          避免把"条评论""次转发"混入正文提取结果。
                        */}
                        <section className="post-actions" aria-label="social actions">
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
                        </section>
                    </div>
                </article>

                {/*
                  <section class="comments"> 单独包裹评论区。
                  aria-label="comments" 让爬虫把评论与主帖正文区分开，
                  不会把评论内容混入帖子摘要。
                */}
                <section className="comments" aria-label="comments">
                    <PublicCommentsList
                        messageId={id}
                        authorCommentSortOrder={message?.authorCommentSortOrder}
                    />
                </section>
            </main>

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
