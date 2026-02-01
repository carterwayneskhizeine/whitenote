import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/public/comments/[id]
 * 公开的 API 端点，用于分享页面，不需要认证
 * 返回评论及其排序偏好（硬编码）
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, name: true, avatar: true, email: true },
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
        select: { id: true, url: true, type: true, description: true },
      },
      message: {
        select: {
          id: true,
          content: true,
          author: {
            select: { id: true, name: true, avatar: true, email: true },
          },
        },
      },
    },
  })

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 硬编码评论排序偏好：true = 最新靠前，false = 最早靠前
  const HARDCODED_SORT_ORDER = false

  const commentData = {
    ...comment,
    messageAuthorCommentSortOrder: HARDCODED_SORT_ORDER,
  }

  return Response.json({ data: commentData })
}
