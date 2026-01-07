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
        select: { replies: true, retweets: true }
      },
      retweets: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
  })

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 添加转发相关字段
  const retweetCount = (comment as any)._count.retweets
  const isRetweeted = (comment as any).retweets.length > 0

  // @ts-ignore - retweets is included in the query
  const { retweets, ...commentData } = comment

  const commentWithRetweetInfo = {
    ...commentData,
    retweetCount,
    isRetweeted,
  }

  return Response.json({ data: commentWithRetweetInfo })
}

/**
 * DELETE /api/comments/[id]
 * 删除评论
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 检查评论是否存在以及用户是否有权限删除
  const comment = await prisma.comment.findUnique({
    where: { id },
  })

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 只有作者可以删除自己的评论
  if (comment.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // 删除评论（级联删除子评论）
  await prisma.comment.delete({
    where: { id },
  })

  return Response.json({ success: true })
}
