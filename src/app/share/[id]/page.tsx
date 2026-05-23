import { Metadata } from "next"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { marked } from "marked"
import { Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { getHandle } from "@/lib/utils"
import prisma from "@/lib/prisma"
import ShareHeaderActions from "./ShareHeaderActions"
import ShareExpandable from "./ShareExpandable"

interface Props {
    params: Promise<{ id: string }>
}

// ── Types ──────────────────────────────────────────────────────────────────────

type CommentRow = {
    id: string
    parentId: string | null
    content: string
    createdAt: Date
    updatedAt: Date
    author: { id: string; name: string | null; avatar: string | null; email: string } | null
    tags: { tag: { id: string; name: string; color: string | null } }[]
    medias: { id: string; url: string; type: string; description: string | null }[]
    _count: { replies: number }
}

type CommentNode = CommentRow & { replies: CommentNode[] }

// ── Data fetching ──────────────────────────────────────────────────────────────

async function getPageData(id: string) {
    const [message, comments] = await Promise.all([
        prisma.message.findUnique({
            where: { id },
            include: {
                author: { select: { id: true, name: true, avatar: true, email: true } },
                quotedMessage: {
                    select: {
                        id: true, content: true, createdAt: true,
                        author: { select: { id: true, name: true, avatar: true, email: true } },
                        medias: { select: { id: true, url: true, type: true, description: true } },
                    },
                },
                quotedComment: {
                    select: {
                        id: true, content: true, createdAt: true, messageId: true,
                        author: { select: { id: true, name: true, avatar: true, email: true } },
                        medias: { select: { id: true, url: true, type: true, description: true } },
                    },
                },
                tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
                medias: { select: { id: true, url: true, type: true, description: true } },
                _count: { select: { comments: true, retweets: true } },
            },
        }),
        prisma.comment.findMany({
            where: { messageId: id },
            include: {
                author: { select: { id: true, name: true, avatar: true, email: true } },
                tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
                medias: { select: { id: true, url: true, type: true, description: true } },
                _count: { select: { replies: true } },
            },
            orderBy: { createdAt: "asc" },
        }),
    ])
    return { message, comments: comments as CommentRow[] }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildCommentTree(flat: CommentRow[]): CommentNode[] {
    const map = new Map<string, CommentNode>()
    for (const c of flat) map.set(c.id, { ...c, replies: [] })

    const roots: CommentNode[] = []
    for (const node of map.values()) {
        if (node.parentId) {
            map.get(node.parentId)?.replies.push(node)
        } else {
            roots.push(node)
        }
    }
    return roots
}

function extractPlainText(content: string): string {
    return content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[.*?\]\(.*?\)/g, "")
        .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/[*_~]{1,2}([^*_~\n]+)[*_~]{1,2}/g, "$1")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/^\s*>\s*/gm, "")
        .replace(/\n{2,}/g, " ")
        .trim()
}

// ── Comment rendering (recursive, server-side) ─────────────────────────────────

function CommentBlock({ comment, depth = 0 }: { comment: CommentNode; depth?: number }) {
    const authorName = comment.author?.name || "GoldieRill"
    const authorHandle = getHandle(comment.author?.email || null, !!comment.author)
    const htmlContent = marked(comment.content) as string

    return (
        <div
            className={depth > 0 ? "ml-10 border-l-2 border-border pl-4" : ""}
            data-comment-id={comment.id}
            data-comment-depth={depth}
        >
            <div className="py-4">
                {/* Author row */}
                <div className="flex items-start gap-3 mb-3">
                    <div className="shrink-0">
                        <GoldieAvatar
                            name={comment.author?.name || null}
                            avatar={comment.author?.avatar || null}
                            size="sm"
                            isAI={!comment.author}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{authorName}</span>
                            <span className="text-muted-foreground text-xs">@{authorHandle}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <time dateTime={new Date(comment.createdAt).toISOString()}>
                                {format(new Date(comment.createdAt), "yyyy'年'M'月'd'日' HH:mm", { locale: zhCN })}
                            </time>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div
                    className="prose prose-neutral dark:prose-invert max-w-none prose-sm
                               prose-p:my-1 prose-pre:bg-muted prose-pre:rounded
                               prose-code:before:content-none prose-code:after:content-none"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                {/* Tags */}
                {comment.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {comment.tags.map(({ tag }) => (
                            <Badge key={tag.id} variant="secondary" className="text-xs px-2 py-0">
                                #{tag.name}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* Replies — rendered recursively, same server-side HTML */}
            {comment.replies.map((reply) => (
                <CommentBlock key={reply.id} comment={reply} depth={depth + 1} />
            ))}
        </div>
    )
}

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params
    const { message } = await getPageData(id)
    if (!message) return { title: "帖子不存在 · WhiteNote" }

    const authorName = message.author?.name || "GoldieRill"
    const authorHandle = getHandle(message.author?.email || null, !!message.author)
    const plainText = extractPlainText(message.content)
    const shareUrl = `https://whitenote.goldie-rill.top/share/${id}`

    return {
        title: `${authorName} (@${authorHandle}) · WhiteNote`,
        description: plainText.slice(0, 200),
        openGraph: {
            title: `${authorName} on WhiteNote`,
            description: plainText.slice(0, 200),
            url: shareUrl,
            type: "article",
            publishedTime: new Date(message.createdAt).toISOString(),
            authors: [authorName],
            tags: message.tags.map(({ tag }) => tag.name),
        },
        alternates: {
            types: { "text/markdown": `/share/${id}/markdown` },
        },
    }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function SharePage({ params }: Props) {
    const { id } = await params
    const { message, comments } = await getPageData(id)

    if (!message) notFound()

    const authorName = message.author?.name || "GoldieRill"
    const authorHandle = getHandle(message.author?.email || null, !!message.author)
    const retweetCount = (message._count as any).retweets ?? 0
    const plainText = extractPlainText(message.content)
    const htmlContent = marked(message.content) as string
    const commentTree = buildCommentTree(comments)

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        "@id": `https://whitenote.goldie-rill.top/share/${id}`,
        url: `https://whitenote.goldie-rill.top/share/${id}`,
        headline: plainText.slice(0, 110),
        author: { "@type": "Person", name: authorName, identifier: `@${authorHandle}` },
        datePublished: new Date(message.createdAt).toISOString(),
        dateModified: new Date(message.updatedAt).toISOString(),
        articleBody: plainText,
        keywords: message.tags.map(({ tag }) => tag.name).join(", ") || undefined,
        interactionStatistic: [
            { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: message._count.comments },
            { "@type": "InteractionCounter", interactionType: "https://schema.org/ShareAction", userInteractionCount: retweetCount },
        ],
        isBasedOn: `https://whitenote.goldie-rill.top/share/${id}/markdown`,
    }

    const clientMessage = {
        id: message.id,
        content: message.content,
        authorName,
        authorHandle,
        createdAt: message.createdAt.toISOString(),
        tags: message.tags.map(({ tag }) => tag.name),
    }

    return (
        <div className="min-h-screen bg-background">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <ShareHeaderActions message={clientMessage} />

            <main className="max-w-3xl mx-auto">
                {/*
                  The entire thread — post + all comments + all replies — is rendered
                  server-side in a single <article>. No client-side fetch, no separate
                  requests. AI crawlers read the full conversation in one go.
                */}
                <article className="whitenote-post" data-post-id={id}>
                    <div className="p-6">
                        {/* ── Post header ── */}
                        <header className="post-header">
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
                                        <span className="font-bold text-lg" itemProp="author">{authorName}</span>
                                        <span className="text-muted-foreground">@{authorHandle}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <time dateTime={new Date(message.createdAt).toISOString()}>
                                            {format(new Date(message.createdAt), "yyyy'年'M'月'd'日' HH:mm", { locale: zhCN })}
                                        </time>
                                        {message.updatedAt &&
                                            new Date(message.updatedAt).getTime() > new Date(message.createdAt).getTime() + 1000 && (
                                                <span>· 已编辑</span>
                                            )}
                                    </div>
                                </div>
                            </div>

                            {message.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4" aria-label="标签">
                                    {message.tags.map(({ tag }) => (
                                        <Badge key={tag.id} variant="secondary" className="text-sm font-normal px-2.5 py-0.5">
                                            <span rel="tag">#{tag.name}</span>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </header>

                        {/* ── Post body ── */}
                        <section className="post-content">
                            <ShareExpandable medias={message.medias}>
                                <div
                                    className="prose prose-neutral dark:prose-invert max-w-none
                                               prose-pre:bg-muted prose-pre:rounded-lg
                                               prose-code:before:content-none prose-code:after:content-none
                                               prose-img:rounded-lg prose-img:my-2"
                                    data-article-body
                                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                                />
                            </ShareExpandable>

                            {(message.quotedMessage || message.quotedComment) && (
                                <div className="mb-4">
                                    <QuotedMessageCard
                                        message={
                                            message.quotedMessage
                                                ? { ...message.quotedMessage, createdAt: message.quotedMessage.createdAt.toISOString() }
                                                : { ...message.quotedComment!, createdAt: message.quotedComment!.createdAt.toISOString() }
                                        }
                                    />
                                </div>
                            )}
                        </section>

                        {/* ── Interaction counts ── */}
                        <section className="post-actions" aria-label="social actions">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-foreground">{message._count.comments}</span>
                                        <span>条评论</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-foreground">{retweetCount}</span>
                                        <span>次转发</span>
                                    </div>
                                </div>
                                <div className="text-xs">WhiteNote</div>
                            </div>
                        </section>
                    </div>

                    {/* ── Comments — server-rendered inline, no client fetch ── */}
                    {commentTree.length > 0 && (
                        <section aria-label="comments" className="border-t border-border">
                            <div className="px-6 py-3 text-sm font-semibold text-muted-foreground">
                                {message._count.comments} 条评论
                            </div>
                            <div className="px-6 divide-y divide-border">
                                {commentTree.map((comment) => (
                                    <CommentBlock key={comment.id} comment={comment} depth={0} />
                                ))}
                            </div>
                        </section>
                    )}
                </article>
            </main>
        </div>
    )
}
