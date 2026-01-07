import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/messages/[id]/comments
 * 获取消息的评论列表
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const comments = await prisma.comment.findMany({
    where: { messageId: id },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
      _count: {
        select: { replies: true }
      }
    },
    orderBy: { createdAt: "asc" },
  })

  return Response.json({ data: comments })
}

/**
 * POST /api/messages/[id]/comments
 * 添加评论
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 验证消息存在
  const message = await prisma.message.findUnique({
    where: { id },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { content, parentId } = body

    if (!content || content.trim() === "") {
      return Response.json({ error: "Content is required" }, { status: 400 })
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        messageId: id,
        authorId: session.user.id,
        isAIBot: false,
        parentId: parentId || null,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true, email: true } },
      },
    })

    return Response.json({ data: comment }, { status: 201 })
  } catch (error) {
    console.error("Failed to create comment:", error)
    return Response.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
