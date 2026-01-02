import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getPaginationParams } from "@/lib/validation"
import { NextRequest } from "next/server"

/**
 * GET /api/search
 * 全局搜索
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query || query.trim() === "") {
    return Response.json({ error: "Query is required" }, { status: 400 })
  }

  const { page, limit, skip } = getPaginationParams(request)

  // 保存搜索历史
  await prisma.searchHistory.create({
    data: { query: query.trim() },
  })

  // 搜索消息
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
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
        _count: { select: { children: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.message.count({
      where: {
        authorId: session.user.id,
        content: { contains: query.trim(), mode: "insensitive" },
      },
    }),
  ])

  return Response.json({
    data: messages,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}
