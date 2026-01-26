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
    orderBy: { updatedAt: "desc" },
  })

  // 添加转发相关字段（只统计 Retweet 表的记录，避免与引用转发重复计数）
  const childCommentsWithRetweetInfo = childComments.map((comment: any) => ({
    ...comment,
    _count: {
      ...comment._count,
    },
    retweetCount: comment._count.retweets,
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
