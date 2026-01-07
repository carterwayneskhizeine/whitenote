import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getPaginationParams } from "@/lib/validation"
import { addTask } from "@/lib/queue"
import { NextRequest } from "next/server"

/**
 * GET /api/messages
 * 获取消息列表 (时间线)
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { page, limit, skip } = getPaginationParams(request)
  const searchParams = request.nextUrl.searchParams

  // 解析过滤参数
  const tagId = searchParams.get("tagId")
  const isStarred = searchParams.get("isStarred") === "true" ? true : undefined
  const isPinned = searchParams.get("isPinned") === "true" ? true : undefined
  const parentId = searchParams.get("parentId")
  const rootOnly = searchParams.get("rootOnly") === "true"

  // 构建查询条件
  const where: Record<string, unknown> = {
    authorId: session.user.id,
  }

  if (tagId) {
    where.tags = { some: { tagId } }
  }
  if (isStarred !== undefined) {
    where.isStarred = isStarred
  }
  if (isPinned !== undefined) {
    where.isPinned = isPinned
  }
  if (parentId) {
    where.parentId = parentId
  } else if (rootOnly) {
    where.parentId = null
  }

  // 查询消息
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
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
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: { children: true, comments: true, retweets: true },
        },
        retweets: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.message.count({ where }),
  ])

  // 添加转发相关字段
  const messagesWithRetweetInfo = messages.map((message) => ({
    ...message,
    retweetCount: message._count.retweets,
    isRetweeted: message.retweets.length > 0,
  }))

  return Response.json({
    data: messagesWithRetweetInfo,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
}

/**
 * POST /api/messages
 * 创建新消息
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { content, title, parentId, tags, quotedMessageId } = body

    if (!content || content.trim() === "") {
      return Response.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    // 验证父消息存在 (如果指定)
    if (parentId) {
      const parent = await prisma.message.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        return Response.json(
          { error: "Parent message not found" },
          { status: 404 }
        )
      }
    }

    // 验证引用消息存在 (如果指定)
    if (quotedMessageId) {
      const quotedMessage = await prisma.message.findUnique({
        where: { id: quotedMessageId },
      })
      if (!quotedMessage) {
        return Response.json(
          { error: "Quoted message not found" },
          { status: 404 }
        )
      }
    }

    // 创建消息
    const message = await prisma.message.create({
      data: {
        title: title?.trim() || null,
        content: content.trim(),
        authorId: session.user.id,
        parentId: parentId || null,
        quotedMessageId: quotedMessageId || null,
        // 创建或关联标签
        tags: tags?.length
          ? {
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
        author: {
          select: { id: true, name: true, avatar: true, email: true },
        },
        quotedMessage: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: { children: true, comments: true, retweets: true },
        },
        retweets: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
    })

    // 添加转发相关字段
    const messageWithRetweetInfo = {
      ...message,
      retweetCount: message._count.retweets,
      isRetweeted: message.retweets.length > 0,
    }

    // 获取用户 AI 配置
    const config = await prisma.aiConfig.findUnique({
      where: { userId: session.user.id },
    })

    // 添加自动打标签任务（如果启用）
    if (config?.enableAutoTag) {
      await addTask("auto-tag", {
        userId: session.user.id,
        messageId: message.id,
      })
    }

    // 添加 RAGFlow 同步任务（始终保持同步）
    await addTask("sync-ragflow", {
      userId: session.user.id,
      messageId: message.id,
    })

    return Response.json({ data: messageWithRetweetInfo }, { status: 201 })
  } catch (error) {
    console.error("Failed to create message:", error)
    return Response.json(
      { error: "Failed to create message" },
      { status: 500 }
    )
  }
}
