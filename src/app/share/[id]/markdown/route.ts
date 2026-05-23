import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getHandle } from "@/lib/utils"
import { format } from "date-fns"

interface RouteContext {
    params: Promise<{ id: string }>
}

type CommentRow = {
    id: string
    parentId: string | null
    content: string
    createdAt: Date
    author: { name: string | null; email: string } | null
    tags: { tag: { name: string } }[]
    medias: { url: string; type: string; description: string | null }[]
    _count: { replies: number }
}

function formatComment(comment: CommentRow, depth: number): string[] {
    const heading = "#".repeat(Math.min(depth + 2, 6)) // h3 for top-level, h4 for replies
    const authorName = comment.author?.name || "GoldieRill"
    const authorHandle = getHandle(comment.author?.email || null, !!comment.author)
    const time = format(new Date(comment.createdAt), "yyyy-MM-dd HH:mm")
    const tags = comment.tags.map(({ tag }) => `#${tag.name}`).join(" ")

    const lines: string[] = [
        `${heading} ${authorName} (@${authorHandle}) · ${time}`,
        ``,
        comment.content,
    ]

    if (tags) lines.push(``, tags)

    for (const media of comment.medias) {
        if (media.type === "image") {
            lines.push(``, `![${media.description || "图片"}](${media.url})`)
        } else {
            lines.push(``, `[视频附件](${media.url})`)
        }
    }

    return lines
}

/**
 * GET /share/[id]/markdown
 * Returns the full post thread (post + all comments + replies) as structured Markdown.
 * Designed for AI agent consumption — one fetch gets the entire conversation.
 * Content-Type: text/markdown; charset=utf-8
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
    const { id } = await params

    // Fetch post and all comments in two parallel queries
    const [message, allComments] = await Promise.all([
        prisma.message.findUnique({
            where: { id },
            include: {
                author: { select: { name: true, email: true } },
                tags: { include: { tag: { select: { name: true } } } },
                medias: { select: { url: true, type: true, description: true } },
                _count: { select: { comments: true, retweets: true } },
            },
        }),
        prisma.comment.findMany({
            where: { messageId: id },
            include: {
                author: { select: { name: true, email: true } },
                tags: { include: { tag: { select: { name: true } } } },
                medias: { select: { url: true, type: true, description: true } },
                _count: { select: { replies: true } },
            },
            orderBy: { createdAt: "asc" },
        }),
    ])

    if (!message) {
        return new Response("# 404 Not Found\n\nThis post does not exist.", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
        })
    }

    const authorName = message.author?.name || "GoldieRill"
    const authorHandle = getHandle(message.author?.email || null, !!message.author)
    const publishedAt = format(new Date(message.createdAt), "yyyy-MM-dd HH:mm")
    const tags = message.tags.map(({ tag }) => `#${tag.name}`).join(" ")
    const retweetCount = (message._count as any).retweets ?? 0
    const shareUrl = `https://whitenote.goldie-rill.top/share/${id}`

    // ── Post metadata + body ───────────────────────────────────────────────────
    const lines: string[] = [
        `# ${authorName} on WhiteNote`,
        ``,
        `| 字段 | 值 |`,
        `|------|-----|`,
        `| 作者 | ${authorName} (@${authorHandle}) |`,
        `| 发布时间 | ${publishedAt} |`,
        ...(tags ? [`| 标签 | ${tags} |`] : []),
        `| 链接 | [${shareUrl}](${shareUrl}) |`,
        `| 评论 | ${message._count.comments} 条 |`,
        `| 转发 | ${retweetCount} 次 |`,
        ``,
        `---`,
        ``,
        `## 正文`,
        ``,
        message.content,
    ]

    if (message.medias.length > 0) {
        lines.push(``, `---`, ``, `## 媒体附件`)
        for (const media of message.medias) {
            if (media.type === "image") {
                lines.push(``, `![${media.description || "图片"}](${media.url})`)
            } else {
                lines.push(``, `[视频附件](${media.url})`)
            }
        }
    }

    // ── Comments tree ─────────────────────────────────────────────────────────
    if (allComments.length > 0) {
        // Build parent → children map entirely in memory (no extra DB round-trips)
        const childrenOf = new Map<string | null, CommentRow[]>()
        for (const c of allComments as CommentRow[]) {
            const bucket = childrenOf.get(c.parentId) ?? []
            bucket.push(c)
            childrenOf.set(c.parentId, bucket)
        }

        const topLevel = childrenOf.get(null) ?? []

        lines.push(``, `---`, ``, `## 评论 (${message._count.comments} 条)`)

        // Render recursively: top-level = h3, replies = h4, deeper = h5/h6
        const renderTree = (nodes: CommentRow[], depth: number) => {
            for (const node of nodes) {
                lines.push(``, ...formatComment(node, depth))
                const replies = childrenOf.get(node.id)
                if (replies?.length) {
                    renderTree(replies, depth + 1)
                }
            }
        }

        renderTree(topLevel, 1)
    }

    return new Response(lines.join("\n"), {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            "X-Robots-Tag": "index",
        },
    })
}
