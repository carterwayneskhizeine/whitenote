import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/comments/[id]/path
 * 获取评论的完整祖先链（用于面包屑导航）
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // 查找目标评论并检查权限
  const targetComment = await prisma.comment.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
      message: {
        select: {
          id: true,
          authorId: true,
        },
      },
    },
  })

  if (!targetComment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 权限检查：只有消息作者可以查看评论（评论继承消息的权限）
  // 系统消息（authorId 为 null）所有用户都可以查看
  if (targetComment.message.authorId !== null && targetComment.message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
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
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}
