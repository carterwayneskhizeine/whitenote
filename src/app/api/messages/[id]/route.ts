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
        select: { id: true, name: true, avatar: true },
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      children: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          _count: { select: { children: true, comments: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
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
        select: { children: true, comments: true, versions: true },
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

  return Response.json({ data: message })
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
                tags.map(async (tagName: string) => {
                  const tag = await prisma.tag.upsert({
                    where: { name: tagName },
                    create: { name: tagName },
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
