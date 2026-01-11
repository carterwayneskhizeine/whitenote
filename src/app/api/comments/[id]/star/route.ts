import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * POST /api/comments/[id]/star
 * 切换评论的收藏状态
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // 获取评论
    const comment = await prisma.comment.findUnique({
      where: { id },
    })

    if (!comment) {
      return Response.json({ error: "Comment not found" }, { status: 404 })
    }

    // 切换isStarred状态
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        isStarred: !comment.isStarred,
      },
      select: {
        id: true,
        isStarred: true,
      },
    })

    return Response.json({ data: updatedComment })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to toggle star:", error)
    return Response.json({ error: "Failed to toggle star" }, { status: 500 })
  }
}
