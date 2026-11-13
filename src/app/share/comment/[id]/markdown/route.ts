import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { SITE_URL, shareUrl } from "@/lib/site-url"
import { getHandle } from "@/lib/utils"
import { getPostTitle } from "@/lib/post-title"
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
}

/** 把内容压成单行摘要，用于「上下文」区块的引用行 */
function excerpt(content: string, max = 200): string {
    const oneLine = content.replace(/\s+/g, " ").trim()
    return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

function formatComment(comment: CommentRow, depth: number): string[] {
    const heading = "#".repeat(Math.min(depth + 3, 6)) // h3 for direct replies, deeper for nested
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
 * GET /share/comment/[id]/markdown
 * 返回单条评论的完整线程（评论正文 + 上下文 + 全部嵌套回复），Markdown 格式。
 * 供 AI agent 消费——一次请求拿到整条评论对话。
 * 同时被 proxy 的两个约定复用：
 *   - /share/comment/{id}.md（URL 后缀）
 *   - Accept: text/markdown 内容协商
 * Content-Type: text/markdown; charset=utf-8
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
    const { id } = await params

    const comment = await prisma.comment.findUnique({
        where: { id },
        include: {
            author: { select: { name: true, email: true } },
            tags: { include: { tag: { select: { name: true } } } },
            medias: { select: { url: true, type: true, description: true } },
            parent: {
                select: {
                    id: true,
                    content: true,
                    author: { select: { name: true, email: true } },
                },
            },
            quotedMessage: {
                select: {
                    id: true,
                    content: true,
                    author: { select: { name: true, email: true } },
                },
            },
            message: {
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    author: { select: { name: true, email: true } },
                },
            },
        },
    })

    if (!comment) {
        return new Response("# 404 Not Found\n\nThis comment does not exist.", {
            status: 404,
            headers: { "Content-Type": "text/markdown; charset=utf-8" },
        })
    }

    // 同帖全部评论一次取回，在内存里裁出以本评论为根的子树（含多层嵌套回复）
    const allComments = (await prisma.comment.findMany({
        where: { messageId: comment.messageId },
        select: {
            id: true,
            parentId: true,
            content: true,
            createdAt: true,
            author: { select: { name: true, email: true } },
            tags: { include: { tag: { select: { name: true } } } },
            medias: { select: { url: true, type: true, description: true } },
        },
        orderBy: { createdAt: "asc" },
    })) as (CommentRow & { parentId: string | null })[]

    const childrenOf = new Map<string | null, CommentRow[]>()
    for (const c of allComments) {
        const bucket = childrenOf.get(c.parentId) ?? []
        bucket.push(c)
        childrenOf.set(c.parentId, bucket)
    }
    const replyRoots = childrenOf.get(comment.id) ?? []
    const countReplies = (nodes: CommentRow[]): number =>
        nodes.reduce((sum, n) => sum + 1 + countReplies(childrenOf.get(n.id) ?? []), 0)
    const replyCount = countReplies(replyRoots)

    const authorName = comment.author?.name || "GoldieRill"
    const authorHandle = getHandle(comment.author?.email || null, !!comment.author)
    const publishedAt = format(new Date(comment.createdAt), "yyyy-MM-dd HH:mm")
    const tags = comment.tags.map(({ tag }) => `#${tag.name}`).join(" ")
    const postTitle = getPostTitle(comment.message.content)
    const postUrl = shareUrl(comment.message.id)
    const commentUrl = `${SITE_URL}/share/comment/${comment.id}`

    // ── 元数据 + 评论正文 ──────────────────────────────────────────────────────
    const lines: string[] = [
        `# 评论 · ${postTitle}`,
        ``,
        `| 字段 | 值 |`,
        `|------|-----|`,
        `| 评论作者 | ${authorName} (@${authorHandle}) |`,
        `| 发布时间 | ${publishedAt} |`,
        ...(tags ? [`| 标签 | ${tags} |`] : []),
        `| 所属帖子 | [${postTitle}](${postUrl}) |`,
        `| 评论链接 | ${commentUrl} |`,
        `| 回复 | ${replyCount} 条 |`,
        ``,
        `---`,
        ``,
        `## 评论内容`,
        ``,
        comment.content,
    ]

    if (comment.medias.length > 0) {
        lines.push(``, `---`, ``, `## 媒体附件`)
        for (const media of comment.medias) {
            if (media.type === "image") {
                lines.push(``, `![${media.description || "图片"}](${media.url})`)
            } else {
                lines.push(``, `[视频附件](${media.url})`)
            }
        }
    }

    // ── 上下文（所属帖子 / 正在回复 / 引用帖子）────────────────────────────────
    const contextBlocks: string[] = []
    contextBlocks.push(
        `### 所属帖子`,
        ``,
        `> ${(comment.message.author?.name || "GoldieRill")}：${excerpt(comment.message.content)}`,
        ``,
        `见 [${postTitle}](${postUrl})`,
    )
    if (comment.parent) {
        contextBlocks.push(
            ``,
            `### 正在回复 ${comment.parent.author?.name || "GoldieRill"}`,
            ``,
            `> ${excerpt(comment.parent.content)}`,
        )
    }
    if (comment.quotedMessage) {
        contextBlocks.push(
            ``,
            `### 引用 ${comment.quotedMessage.author?.name || "GoldieRill"}`,
            ``,
            `> ${excerpt(comment.quotedMessage.content)}`,
            ``,
            `见 [原帖](${shareUrl(comment.quotedMessage.id)})`,
        )
    }
    lines.push(``, `---`, ``, `## 上下文`, ``, ...contextBlocks)

    // ── 回复树 ────────────────────────────────────────────────────────────────
    if (replyRoots.length > 0) {
        lines.push(``, `---`, ``, `## 回复 (${replyCount} 条)`)
        const renderTree = (nodes: CommentRow[], depth: number) => {
            for (const node of nodes) {
                lines.push(``, ...formatComment(node, depth))
                const replies = childrenOf.get(node.id)
                if (replies?.length) renderTree(replies, depth + 1)
            }
        }
        renderTree(replyRoots, 0)
    }

    return new Response(lines.join("\n"), {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            "X-Robots-Tag": "index",
        },
    })
}
