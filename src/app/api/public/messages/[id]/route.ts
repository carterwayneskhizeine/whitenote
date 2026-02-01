import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/public/messages/[id]
 * 公开的 API 端点，用于分享页面，不需要认证
 * 返回消息及其评论排序偏好（硬编码）
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const message = await prisma.message.findUnique({
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
      quotedComment: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          messageId: true,
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
      _count: {
        select: { comments: true, retweets: true },
      },
    },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  // 硬编码评论排序偏好：true = 最新靠前，false = 最早靠前
  const HARDCODED_SORT_ORDER = false

  // 添加转发计数和作者偏好
  const retweetCount = (message as any)._count.retweets

  const messageData = {
    ...message,
    retweetCount,
    authorCommentSortOrder: HARDCODED_SORT_ORDER,
  }

  return Response.json({ data: messageData })
}
