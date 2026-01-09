import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { deleteFromRAGFlow, updateRAGFlow } from "@/lib/ai/ragflow"
import { NextRequest } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * 构建包含标签的内容（用于 RAGFlow 同步）
 */
async function buildContentWithTags(messageId: string): Promise<string> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      content: true,
      tags: {
        include: {
          tag: { select: { name: true } },
        },
        orderBy: {
          tag: { name: 'asc' },
        },
      },
    },
  })

  if (!message) return ''

  // 如果有标签，格式化标签放在内容开头
  if (message.tags.length > 0) {
    const tagLine = message.tags.map((t) => `#${t.tag.name}`).join('  ')
    return `${tagLine}\n\n${message.content}`
  }

  return message.content
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

  // 权限检查：系统消息（authorId 为 null）所有用户都可以查看
  if (message.authorId !== null && message.authorId !== session.user.id) {
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

  // 权限检查：系统消息可以被任何人编辑
  if (existing.authorId !== null && existing.authorId !== session.user.id) {
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

    // 同步更新 RAGFlow 文档（异步执行，不阻塞响应）
    // 触发条件：内容变化 或 标签变化
    const contentChanged = content && content !== existing.content
    const tagsChanged = tags !== undefined

    if (contentChanged || tagsChanged) {
      // 获取更新后的完整内容（包含标签）
      const contentWithTags = await buildContentWithTags(id)

      updateRAGFlow(session.user.id, id, contentWithTags).catch((error) => {
        console.error("Failed to update RAGFlow document:", error)
      })
    }

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

  // 权限检查：系统消息可以被任何人删除
  if (existing.authorId !== null && existing.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // 先从 RAGFlow 删除对应的文档
  try {
    await deleteFromRAGFlow(session.user.id, id)
  } catch (error) {
    console.error("Failed to delete from RAGFlow:", error)
    // 继续删除本地消息，不因 RAGFlow 删除失败而中断
  }

  // 删除本地消息
  await prisma.message.delete({
    where: { id },
  })

  return Response.json({ success: true })
}
