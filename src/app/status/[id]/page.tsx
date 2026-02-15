"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Message, messagesApi } from "@/lib/api/messages"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MoreVertical, Loader2, Edit2, Pin, PinOff, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CommentsList } from "@/components/CommentsList"
import { TipTapViewer } from "@/components/TipTapViewer"
import { MediaGrid } from "@/components/MediaGrid"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn, getHandle } from "@/lib/utils"
import { ReplyDialog } from "@/components/ReplyDialog"
import { RetweetDialog } from "@/components/RetweetDialog"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { ShareDialog } from "@/components/ShareDialog"
import { ImageLightbox } from "@/components/ImageLightbox"
import { useShare } from "@/hooks/useShare"
import { ActionRow } from "@/components/ActionRow"
import { useMobile } from "@/hooks/use-mobile"

export default function StatusPage() {
    const { id } = useParams() as { id: string }
    const router = useRouter()
    const isMobile = useMobile()
    const [message, setMessage] = useState<Message | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [showReplyDialog, setShowReplyDialog] = useState(false)
    const [replyTarget, setReplyTarget] = useState<any>(null)
    const [showRetweetDialog, setShowRetweetDialog] = useState(false)
    const { showShareDialog, setShowShareDialog, handleShare, shareItemId } = useShare()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const [copied, setCopied] = useState(false)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [markdownImages, setMarkdownImages] = useState<string[]>([])
    const contentRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [isExpanded, setIsExpanded] = useState(false)
    const [hasMore, setHasMore] = useState(false)

    useEffect(() => {
        const fetchMessage = async () => {
            try {
                const result = await messagesApi.getMessage(id)
                if (result.data) {
                    setMessage(result.data)
                } else if (result.error) {
                    setError(result.error)
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
    }, [id, refreshKey])

    // Extract markdown images from content
    useEffect(() => {
        if (message?.content) {
            // 使用 Set 去重，确保相同的 URL 只出现一次
            const images = Array.from(new Set(
                message.content.match(/!\[.*?\]\(([^)]+)\)/g)?.map(match => {
                    const url = match.match(/!\[.*?\]\(([^)]+)\)/)?.[1]
                    return url || ''
                }).filter(url => url && !url.startsWith('data:')) || []
            ))
            setMarkdownImages(images)
        }
    }, [message?.content])

    const handleTogglePin = async () => {
        if (!message) return
        try {
            const result = await messagesApi.togglePin(message.id)
            if (result.data) {
                setMessage({ ...message, isPinned: result.data.isPinned })
            }
        } catch (error) {
            console.error("Failed to toggle pin:", error)
        }
    }

    const handleDelete = async () => {
        if (!message) return
        setIsDeleting(true)
        try {
            const result = await messagesApi.deleteMessage(message.id)
            if (result.success) {
                router.push('/')
            }
        } catch (error) {
            console.error("Failed to delete message:", error)
        } finally {
            setIsDeleting(false)
            setShowDeleteDialog(false)
        }
    }

    const handleCopy = async () => {
        if (!message) return
        try {
            // Copy the raw Markdown content directly (preserves code blocks and formatting)
            await navigator.clipboard.writeText(message.content)
            setCopied(true)
            setTimeout(() => setCopied(false), 1000)
        } catch (error) {
            console.error("Failed to copy message:", error)
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
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !message) {
        return (
            <div className="p-8 text-center">
                <p className="text-muted-foreground mb-4">{error || "Message not found"}</p>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        )
    }


    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border flex items-center px-4 h-[53px]">
                <Button
                    variant="ghost"
                    size="icon"
                    className="mr-4 rounded-full"
                    onClick={() => router.push(`/?scrollto=${id}`)}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold">帖子</h1>
            </div>

            {/* Main Post Content */}
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-sm leading-5">
                        {message.author ? (
                            <>
                                <span className="font-bold text-foreground hover:underline">
                                    {message.author.name || "GoldieRill"}
                                </span>
                                <span className="text-muted-foreground">
                                    @{getHandle(message.author?.email || null, !!message.author)}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="font-bold text-purple-600 hover:underline">
                                    GoldieRill
                                </span>
                                <span className="text-muted-foreground">
                                    @AI
                                </span>
                            </>
                        )}
                        <span className="text-muted-foreground px-1">·</span>
                        <span className="text-muted-foreground">
                            {format(new Date(message.createdAt), "a h:mm · yyyy'年'M'月'd'日'", { locale: zhCN })}
                        </span>
                        {message.updatedAt && new Date(message.updatedAt).getTime() > new Date(message.createdAt).getTime() + 1000 && (
                            <>
                                <span className="text-muted-foreground px-1">·</span>
                                <span className="text-muted-foreground">已编辑</span>
                            </>
                        )}

                        {/* Tags displayed after user info */}
                        {message.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {message.tags.map(({ tag }) => (
                                    <span key={tag.id} className="text-primary hover:underline cursor-pointer">
                                        #{tag.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/status/${message.id}/edit`)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleTogglePin}>
                                {message.isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                                {message.isPinned ? "取消置顶" : "置顶"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div
                    ref={contentRef}
                    className="mt-4 text-sm leading-normal wrap-break-word break-words text-foreground"
                >
                    <TipTapViewer 
                        content={message.content} 
                        onImageClick={handleMarkdownImageClick}
                        maxLines={9}
                        isExpanded={isExpanded}
                        onOverflow={setHasMore}
                    />
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
                        className="text-primary text-sm font-medium mt-1 hover:underline text-left w-fit"
                    >
                        显示更多
                    </button>
                )}

                {/* Media Display */}
                <MediaGrid
                    medias={message.medias || []}
                    onImageClick={handleImageClick}
                    className="mt-4"
                />

                {/* 引用的消息/评论卡片 - 转推时显示 */}
                {(message.quotedMessage || message.quotedComment) && (
                    <QuotedMessageCard message={message.quotedMessage || message.quotedComment!} />
                )}

                <Separator className="my-1" />

                {/* Stats Row */}
                <ActionRow
                    replyCount={message._count.comments}
                    onReply={() => {
                        if (isMobile) {
                            router.push(`/status/${message.id}/reply`)
                        } else {
                            setReplyTarget(message)
                            setShowReplyDialog(true)
                        }
                    }}
                    copied={copied}
                    onCopy={handleCopy}
                    retweetCount={message.retweetCount ?? 0}
                    onRetweet={() => {
                        if (isMobile) {
                            router.push(`/retweet?id=${message.id}&type=message`)
                        } else {
                            setShowRetweetDialog(true)
                        }
                    }}
                    starred={message.isStarred}
                    onToggleStar={async () => {
                        const result = await messagesApi.toggleStar(message.id)
                        if (result.data) {
                            setMessage({ ...message, isStarred: result.data.isStarred })
                        }
                    }}
                    onShare={() => handleShare(message.id)}
                    size="lg"
                    className="px-2"
                />

                <Separator className="my-1" />
            </div>

            {/* Reply Section */}
            <CommentsList
                messageId={message.id}
                onCommentAdded={() => {
                    // Refresh message data to update comment count
                    setRefreshKey(prev => prev + 1)
                }}
            />

            {/* Reply Dialog */}
            <ReplyDialog
                open={showReplyDialog}
                onOpenChange={setShowReplyDialog}
                target={replyTarget}
                messageId={message.id}
                onSuccess={() => {
                    // Refresh message data to update comment count
                    setRefreshKey(prev => prev + 1)
                }}
            />

            {/* Retweet Dialog */}
            <RetweetDialog
                open={showRetweetDialog}
                onOpenChange={setShowRetweetDialog}
                target={message}
                targetType="message"
                onSuccess={() => {
                    // Navigate to home to show the new message
                    router.push('/')
                }}
            />

            {/* Share Dialog */}
            <ShareDialog
                messageId={shareItemId || message.id}
                open={showShareDialog}
                onOpenChange={setShowShareDialog}
            />

            {/* Delete Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除消息</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除这条消息吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "删除中..." : "删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Image Lightbox */}
            <ImageLightbox
                media={(() => {
                    // 去重：提取 message.medias 中的 URL 集合
                    const mediaUrls = new Set(message?.medias?.map(m => m.url) || [])

                    // 过滤掉 markdownImages 中与 message.medias 重复的图片
                    const uniqueMarkdownImages = markdownImages.filter(url => !mediaUrls.has(url))

                    return [
                        ...(message?.medias || []),
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
