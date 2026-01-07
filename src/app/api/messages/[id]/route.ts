import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/messages/[id]
 * 获取单条消息详情
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  const message = await prisma.message.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, name: true, avatar: true, email: true },
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      children: {
        include: {
          author: { select: { id: true, name: true, avatar: true, email: true } },
          _count: { select: { children: true, comments: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, avatar: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      incomingLinks: {
        include: {
          source: {
            select: { id: true, title: true, content: true },
          },
        },
      },
      _count: {
        select: { children: true, comments: true, versions: true, retweets: true },
      },
      retweets: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  // 权限检查
  if (message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // 添加转发相关字段
  const retweetCount = (message as any)._count.retweets
  const isRetweeted = (message as any).retweets.length > 0

  // @ts-ignore - retweets is included in the query
  const { retweets, ...messageData } = message

  const messageWithRetweetInfo = {
    ...messageData,
    retweetCount,
    isRetweeted,
  }

  return Response.json({ data: messageWithRetweetInfo })
}

/**
 * PUT /api/messages/[id]
 * 更新消息
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  const existing = await prisma.message.findUnique({
    where: { id },
  })

  if (!existing) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  if (existing.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { content, title, tags } = body

    // 保存版本历史
    if (content && content !== existing.content) {
      await prisma.messageVersion.create({
        data: {
          messageId: id,
          content: existing.content,
        },
      })
    }

    // 更新消息
    const message = await prisma.message.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() || null : existing.title,
        content: content?.trim() || existing.content,
        // 更新标签 (如果提供)
        tags: tags
          ? {
            deleteMany: {},
            create: await Promise.all(
              // 去重标签数组
              [...new Set(tags as string[])]
                .map(async (tagName) => {
                  const tag = await prisma.tag.upsert({
                    where: { name: (tagName as string).trim() },
                    create: { name: (tagName as string).trim() },
                    update: {},
                  })
                  return { tagId: tag.id }
                })
            ),
          }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: { select: { children: true, comments: true } },
      },
    })

    return Response.json({ data: message })
  } catch (error) {
    console.error("Failed to update message:", error)
    return Response.json(
      { error: "Failed to update message" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/messages/[id]
 * 删除消息
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  const existing = await prisma.message.findUnique({
    where: { id },
  })

  if (!existing) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  if (existing.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.message.delete({
    where: { id },
  })

  return Response.json({ success: true })
}
