import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"
import { unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// Upload directory outside the codebase
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "..", "whitenote-data", "uploads")

/**
 * GET /api/comments/[id]
 * 获取单个评论详情
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
      message: { select: { id: true, content: true } },
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
  })

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 添加转发相关字段
  const retweetCount = (comment as any)._count.retweets
  const isRetweeted = (comment as any).retweets.length > 0

  // 获取被消息引用的数量
  const quotedByCount = await prisma.message.count({
    where: { quotedCommentId: id },
  })

  // @ts-ignore - retweets is included in the query
  const { retweets, ...commentData } = comment

  const commentWithRetweetInfo = {
    ...commentData,
    retweetCount: retweetCount + quotedByCount,
    isRetweeted,
  }

  return Response.json({ data: commentWithRetweetInfo })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}

/**
 * DELETE /api/comments/[id]
 * 删除评论
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    // 检查评论是否存在，并获取关联的媒体文件
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        message: { select: { authorId: true } },
        medias: { select: { id: true, url: true } },
      },
    })

    if (!comment) {
      return Response.json({ error: "Comment not found" }, { status: 404 })
    }

    // 授权检查：
    // 1. 如果评论有作者（普通评论），只有作者可以删除
    // 2. 如果评论没有作者（AI 生成评论），只有消息作者可以删除
    if (comment.authorId) {
      // 普通评论：只有作者可以删除
      if (comment.authorId !== session.user.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      // AI 评论：只有消息作者可以删除
      if (comment.message.authorId !== session.user.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // 先删除媒体文件（在删除评论记录之前）
    if (comment.medias.length > 0) {
      for (const media of comment.medias) {
        try {
          // Extract filename from URL (format: /api/media/${filename})
          const filename = media.url.split('/').pop()
          if (filename) {
            const filePath = join(UPLOAD_DIR, filename)
            if (existsSync(filePath)) {
              await unlink(filePath)
              console.log(`Deleted media file: ${filename}`)
            }
          }
        } catch (error) {
          console.error(`Failed to delete media file ${media.url}:`, error)
          // 继续删除其他文件，不因单个文件删除失败而中断
        }
      }
    }

    // 删除评论（级联删除子评论和 Media 数据库记录）
    await prisma.comment.delete({
      where: { id },
    })

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    throw error
  }
}

/**
 * PATCH /api/comments/[id]
 * 更新评论
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string') {
      return Response.json({ error: "Content is required" }, { status: 400 })
    }

    // 检查评论是否存在
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { message: { select: { authorId: true } } },
    })

    if (!comment) {
      return Response.json({ error: "Comment not found" }, { status: 404 })
    }

    // 授权检查：
    // 1. 如果评论有作者（普通评论），只有作者可以编辑
    // 2. 如果评论没有作者（AI 生成评论），只有消息作者可以编辑
    if (comment.authorId) {
      // 普通评论：只有作者可以编辑
      if (comment.authorId !== session.user.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      // AI 评论：只有消息作者可以编辑
      if (comment.message.authorId !== session.user.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // 更新评论
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: { content },
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
        medias: {
          select: { id: true, url: true, type: true, description: true }
        },
        _count: {
          select: { replies: true, retweets: true }
        },
      },
    })

    return Response.json({ data: updatedComment })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to update comment:", error)
    return Response.json({ error: "Failed to update comment" }, { status: 500 })
  }
}
