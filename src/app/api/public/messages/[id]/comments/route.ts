import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/public/messages/[id]/comments
 * 获取消息的评论列表（公开访问，无需认证）
 * 排序方式已硬编码
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // 硬编码评论排序偏好：true = 最新靠前，false = 最早靠前
    const HARDCODED_SORT_ORDER = false

    const comments = await prisma.comment.findMany({
      where: {
        messageId: id,
        parentId: null, // Only top-level comments
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, email: true }
        },
        quotedMessage: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, avatar: true, email: true }
            },
            medias: {
              select: { id: true, url: true, type: true, description: true }
            }
          }
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        medias: {
          select: { id: true, url: true, type: true, description: true }
        },
        _count: {
          select: { replies: true, retweets: true }
        },
      },
      orderBy: { createdAt: HARDCODED_SORT_ORDER ? "desc" : "asc" },
    })

    // Add retweet count field
    const commentsWithCounts = comments.map((comment: any) => ({
      ...comment,
      retweetCount: comment._count.retweets,
    }))

    return Response.json({ data: commentsWithCounts })
  } catch (error) {
    console.error("Failed to fetch comments:", error)
    return Response.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}
