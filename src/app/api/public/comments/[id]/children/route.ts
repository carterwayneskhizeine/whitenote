import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/public/comments/[id]/children
 * 获取评论的直接子评论（公开访问，无需认证）
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // 验证父评论存在
    const parentComment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!parentComment) {
      return Response.json({ error: "Comment not found" }, { status: 404 })
    }

    // 获取子评论
    const childComments = await prisma.comment.findMany({
      where: { parentId: id },
      include: {
        author: { select: { id: true, name: true, avatar: true, email: true } },
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
      orderBy: { createdAt: "asc" },
    })

    // 添加转发计数
    const childCommentsWithCounts = childComments.map((comment: any) => ({
      ...comment,
      retweetCount: comment._count.retweets,
    }))

    return Response.json({ data: childCommentsWithCounts })
  } catch (error) {
    console.error("Failed to fetch child comments:", error)
    return Response.json({ error: "Failed to fetch child comments" }, { status: 500 })
  }
}
