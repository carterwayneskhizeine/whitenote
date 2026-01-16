import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"
import { addTask } from "@/lib/queue"

/**
 * GET /api/messages/[id]/comments
 * 获取消息的评论列表
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    const comments = await prisma.comment.findMany({
    where: { messageId: id },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
      quotedMessage: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: { id: true, name: true, avatar: true, email: true }
          }
        }
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      medias: {
        select: { id: true, url: true, type: true, description: true }
      },
      _count: {
        select: { replies: true, retweets: true }
      },
      retweets: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // 添加转发相关字段（只统计 Retweet 表的记录，避免与引用转发重复计数）
  const commentsWithRetweetInfo = comments.map((comment: any) => ({
    ...comment,
    _count: {
      ...comment._count,
    },
    retweetCount: comment._count.retweets,
    isRetweeted: comment.retweets.length > 0,
  }))

  return Response.json({ data: commentsWithRetweetInfo })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}

/**
 * POST /api/messages/[id]/comments
 * 添加评论
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // 验证消息存在
    const message = await prisma.message.findUnique({
      where: { id },
    })

    if (!message) {
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    const body = await request.json()
    const { content, parentId, media } = body

    if ((!content || content.trim() === "") && (!media || media.length === 0)) {
      return Response.json({ error: "Content or media is required" }, { status: 400 })
    }

    const comment = await prisma.comment.create({
      data: {
        content: content?.trim() || "",
        messageId: id,
        authorId: session.user.id,
        isAIBot: false,
        parentId: parentId || null,
        medias: media && media.length > 0 ? {
          create: media.map((m: { url: string; type: string }) => ({
            url: m.url,
            type: m.type,
          }))
        } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true, email: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        medias: { select: { id: true, url: true, type: true, description: true } },
      },
    })

    // 获取消息所属的 Workspace 配置
    const messageWithWorkspace = await prisma.message.findUnique({
      where: { id },
      select: {
        workspace: {
          select: { enableAutoTag: true, ragflowDatasetId: true },
        },
      },
    })

    // 添加自动打标签任务（如果 Workspace 启用）
    if (messageWithWorkspace?.workspace?.enableAutoTag) {
      await addTask("auto-tag-comment", {
        userId: session.user.id,
        workspaceId: message.workspaceId,
        commentId: comment.id,
        contentType: 'comment',
      })
    }

    // 同步到 RAGFlow（如果 Workspace 配置了知识库）
    if (messageWithWorkspace?.workspace?.ragflowDatasetId) {
      await addTask("sync-ragflow", {
        userId: session.user.id,
        workspaceId: message.workspaceId,
        messageId: comment.id,
        contentType: 'comment',
      })
    }

    // Check if MD Sync is enabled
    const aiConfig = await prisma.aiConfig.findUnique({
      where: { userId: session.user.id }
    })

    if (aiConfig?.enableMdSync) {
      // 9 seconds delay to allow AI tagging
      await addTask("sync-to-local", {
        type: "comment",
        id: comment.id
      }, {
        delay: 9000
      })
    }

    return Response.json({ data: comment }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to create comment:", error)
    return Response.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
