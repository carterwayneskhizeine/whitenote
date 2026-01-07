import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/comments/[id]/children
 * 获取评论的直接子评论（一级回复）
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 验证父评论存在
  const parentComment = await prisma.comment.findUnique({
    where: { id },
  })

  if (!parentComment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 获取子评论，包含每个子评论的子评论数量
  const childComments = await prisma.comment.findMany({
    where: { parentId: id },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
      _count: {
        select: { replies: true }
      }
    },
    orderBy: { createdAt: "asc" },
  })

  return Response.json({ data: childComments })
}
