import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getPaginationParams } from "@/lib/validation"
import { NextRequest } from "next/server"

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/tags/[id]/messages
 * 获取标签下的所有消息
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { page, limit, skip } = getPaginationParams(request)

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: {
        authorId: session.user.id,
        tags: { some: { tagId: id } },
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
        tags: { some: { tagId: id } },
      },
    }),
  ])

  return Response.json({
    data: messages,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}
