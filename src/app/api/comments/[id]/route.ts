import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/comments/[id]
 * 获取单个评论详情
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
      message: { select: { id: true, content: true } },
      _count: {
        select: { replies: true }
      }
    },
  })

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  return Response.json({ data: comment })
}
