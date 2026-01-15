import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/comments/[id]/children
 * 获取评论的直接子评论（一级回复）
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // 验证父评论存在并检查权限
  const parentComment = await prisma.comment.findUnique({
    where: { id },
    include: {
      message: {
        select: {
          id: true,
          authorId: true,
        },
      },
    },
  })

  if (!parentComment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 权限检查：只有消息作者可以查看评论（评论继承消息的权限）
  // 系统消息（authorId 为 null）所有用户都可以查看
  if (parentComment.message.authorId !== null && parentComment.message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // 获取子评论，包含每个子评论的子评论数量
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
      retweets: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // 获取所有评论ID，用于计算转发总数（包括被消息引用）
  const commentIds = childComments.map(c => c.id)
  const quotedByCounts = await prisma.message.groupBy({
    by: ['quotedCommentId'],
    where: {
      quotedCommentId: { in: commentIds },
    },
    _count: { quotedCommentId: true },
  })
  const quotedByCountMap = Object.fromEntries(
    quotedByCounts.map(r => [r.quotedCommentId!, r._count.quotedCommentId])
  )

  // 添加转发相关字段
  const childCommentsWithRetweetInfo = childComments.map((comment: any) => ({
    ...comment,
    _count: {
      ...comment._count,
    },
    retweetCount: comment._count.retweets + (quotedByCountMap[comment.id] || 0),
    isRetweeted: comment.retweets.length > 0,
  }))

  return Response.json({ data: childCommentsWithRetweetInfo })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
