import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * POST /api/messages/[id]/retweet
 * 切换消息的转发状态
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // 检查消息是否存在
    const message = await prisma.message.findUnique({
      where: { id },
    })

    if (!message) {
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    // 检查是否已经转发过
    const existingRetweet = await prisma.retweet.findUnique({
      where: {
        userId_messageId: {
          userId: session.user.id,
          messageId: id,
        },
      },
    })

    let isRetweeted: boolean

    if (existingRetweet) {
      // 如果已经转发，则取消转发
      await prisma.retweet.delete({
        where: {
          userId_messageId: {
            userId: session.user.id,
            messageId: id,
          },
        },
      })
      isRetweeted = false
    } else {
      // 如果未转发，则添加转发
      await prisma.retweet.create({
        data: {
          userId: session.user.id,
          messageId: id,
        },
      })
      isRetweeted = true
    }

    // 获取转发总数（包括简单转发和引用转发）
    const [simpleRetweetCount, quoteRetweetCount] = await Promise.all([
      prisma.retweet.count({
        where: { messageId: id },
      }),
      prisma.message.count({
        where: { quotedMessageId: id },
      }),
    ])
    const retweetCount = simpleRetweetCount + quoteRetweetCount

    return Response.json({
      data: {
        isRetweeted,
        retweetCount,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to toggle retweet:", error)
    return Response.json({ error: "Failed to toggle retweet" }, { status: 500 })
  }
}
