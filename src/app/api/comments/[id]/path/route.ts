import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/comments/[id]/path
 * 获取评论的完整祖先链（用于面包屑导航）
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 查找目标评论
  const targetComment = await prisma.comment.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
    },
  })

  if (!targetComment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 构建祖先链
  const path: any[] = []
  let currentComment: any = targetComment

  while (currentComment) {
    path.unshift({
      id: currentComment.id,
      content: currentComment.content,
      createdAt: currentComment.createdAt,
      author: currentComment.author,
    })

    // 如果有父评论，继续向上追溯
    if (currentComment.parentId) {
      currentComment = await prisma.comment.findUnique({
        where: { id: currentComment.parentId },
        include: {
          author: { select: { id: true, name: true, avatar: true, email: true } },
        },
      })
    } else {
      currentComment = null
    }
  }

  return Response.json({ data: path })
}
