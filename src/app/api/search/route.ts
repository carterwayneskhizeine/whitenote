import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { getPaginationParams } from "@/lib/validation"
import { NextRequest } from "next/server"

const MAX_SEARCH_HISTORY = 10

/**
 * 保存搜索历史，最多保留10条
 */
async function saveSearchHistory(query: string) {
  // 检查是否已存在相同的查询
  const existing = await prisma.searchHistory.findFirst({
    where: { query },
    orderBy: { createdAt: "desc" },
  })

  // 如果存在相同查询，删除旧的
  if (existing) {
    await prisma.searchHistory.delete({ where: { id: existing.id } })
  }

  // 创建新的搜索历史
  await prisma.searchHistory.create({ data: { query } })

  // 如果超过限制，删除最旧的记录
  const count = await prisma.searchHistory.count()
  if (count > MAX_SEARCH_HISTORY) {
    const oldestRecords = await prisma.searchHistory.findMany({
      orderBy: { createdAt: "asc" },
      take: count - MAX_SEARCH_HISTORY,
      select: { id: true },
    })
    await prisma.searchHistory.deleteMany({
      where: {
        id: { in: oldestRecords.map((r) => r.id) },
      },
    })
  }
}

/**
 * GET /api/search
 * 全局搜索
 *
 * 查询参数:
 * - q: 搜索关键词
 * - saveHistory: 是否保存搜索历史 (默认 true)
 * - history: 是否返回搜索历史 (默认 false)
 * - type: 搜索类型 (all/messages/comments，默认 all)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")
    const saveHistory = searchParams.get("saveHistory") !== "false"
    const returnHistory = searchParams.get("history") === "true"
    const type = searchParams.get("type") || "all"

    // 返回搜索历史
    if (returnHistory) {
      const history = await prisma.searchHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          query: true,
          createdAt: true,
        },
      })
      return Response.json({ data: history })
    }

    if (!query || query.trim() === "") {
      return Response.json({ error: "Query is required" }, { status: 400 })
    }

    const { page, limit, skip } = getPaginationParams(request)

    // 保存搜索历史（仅在明确要求时记录）
    if (saveHistory) {
      await saveSearchHistory(query.trim())
    }

    const searchInMessages = type === "all" || type === "messages"
    const searchInComments = type === "all" || type === "comments"

    // 并行搜索消息和评论
    const [messages, comments, messageTotal, commentTotal] = await Promise.all([
      // 搜索消息
      searchInMessages
        ? prisma.message.findMany({
            where: {
              authorId: session.user.id,
              content: {
                contains: query.trim(),
                mode: "insensitive",
              },
            },
            include: {
              author: { select: { id: true, name: true, avatar: true } },
              tags: {
                include: {
                  tag: { select: { id: true, name: true, color: true } },
                },
              },
              _count: { select: { comments: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : [],
      // 搜索评论
      searchInComments
        ? prisma.comment.findMany({
            where: {
              authorId: session.user.id,
              content: {
                contains: query.trim(),
                mode: "insensitive",
              },
            },
            include: {
              author: { select: { id: true, name: true, avatar: true } },
              message: {
                select: {
                  id: true,
                  content: true,
                  author: {
                    select: { id: true, name: true, avatar: true },
                  },
                },
              },
              parent: {
                select: {
                  id: true,
                  content: true,
                  author: {
                    select: { id: true, name: true, avatar: true },
                  },
                },
              },
              tags: {
                include: {
                  tag: { select: { id: true, name: true, color: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : [],
      // 统计消息总数
      searchInMessages
        ? prisma.message.count({
            where: {
              authorId: session.user.id,
              content: { contains: query.trim(), mode: "insensitive" },
            },
          })
        : 0,
      // 统计评论总数
      searchInComments
        ? prisma.comment.count({
            where: {
              authorId: session.user.id,
              content: { contains: query.trim(), mode: "insensitive" },
            },
          })
        : 0,
    ])

    // 合并并标记类型
    const messagesWithType = messages.map((m) => ({ ...m, type: "message" }))
    const commentsWithType = comments.map((c) => ({ ...c, type: "comment" }))

    // 合并结果并按创建时间排序
    const allResults = [...messagesWithType, ...commentsWithType].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // 分页
    const total = messageTotal + commentTotal
    const paginatedResults = allResults.slice(skip, skip + limit)

    return Response.json({
      data: paginatedResults,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        messageCount: messageTotal,
        commentCount: commentTotal,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
