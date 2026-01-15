import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"
import { unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { batchUpsertTags } from "@/lib/tag-utils"
import { deleteFromRAGFlow } from "@/lib/ai/ragflow"

// Upload directory outside the codebase
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "..", "whitenote-data", "uploads")

/**
 * 递归删除评论及其所有子评论的 RAGFlow 文档
 */
async function deleteCommentRAGFlowDocumentsRecursive(commentId: string, userId: string, datasetId: string) {
  // 先删除子评论的 RAGFlow 文档
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { replies: { select: { id: true } } },
  })

  if (comment) {
    for (const reply of comment.replies) {
      await deleteCommentRAGFlowDocumentsRecursive(reply.id, userId, datasetId)
    }
  }

  // 删除当前评论的 RAGFlow 文档
  try {
    await deleteFromRAGFlow(userId, datasetId, commentId, 'comment')
    console.log(`[DELETE Comment] Deleted RAGFlow document for comment: ${commentId}`)
  } catch (error) {
    console.error(`[DELETE Comment] Failed to delete RAGFlow document for comment ${commentId}:`, error)
  }
}

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
      message: {
        select: {
          id: true,
          content: true,
          authorId: true,
        },
      },
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
  })

  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 })
  }

  // 权限检查：只有消息作者可以查看评论（评论继承消息的权限）
  // 系统消息（authorId 为 null）所有用户都可以查看
  if (comment.message.authorId !== null && comment.message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
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
        message: {
          select: {
            authorId: true,
            workspace: { select: { ragflowDatasetId: true } }
          }
        },
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

    // 先从 RAGFlow 删除对应的文档（如果有配置）
    // 递归删除子评论的 RAGFlow 文档
    try {
      if (comment.message?.workspace?.ragflowDatasetId) {
        await deleteCommentRAGFlowDocumentsRecursive(id, session.user.id, comment.message.workspace.ragflowDatasetId)
      }
    } catch (error) {
      console.error("Failed to delete from RAGFlow:", error)
      // 继续删除本地评论，不因 RAGFlow 删除失败而中断
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
    const { content, tags } = body

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

    // 准备更新数据
    const updateData: any = { content }

    // 如果提供了标签，更新标签
    if (tags !== undefined) {
      updateData.tags = {
        deleteMany: {},
        create: (await batchUpsertTags([...new Set(tags as string[])]))
          .map((tagId) => ({ tagId })),
      }
    }

    // 更新评论
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, avatar: true, email: true } },
        message: {
          select: {
            workspace: { select: { ragflowDatasetId: true } }
          }
        },
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
      },
    })

    // 同步更新 RAGFlow 文档（异步执行，不阻塞响应）
    // 触发条件：内容变化 或 标签变化
    const contentChanged = content !== comment.content
    const tagsChanged = tags !== undefined

    if (contentChanged || tagsChanged) {
      const { buildContentWithTags, updateInKnowledgeBase } = await import("@/lib/knowledge-base")

      // 获取更新后的完整内容（包含标签）
      const contentWithTags = await buildContentWithTags('comment', id)

      // 只有当 Workspace 配置了 RAGFlow Dataset 时才同步
      if (updatedComment.message?.workspace?.ragflowDatasetId) {
        updateInKnowledgeBase(session.user.id, updatedComment.message.workspace.ragflowDatasetId, 'comment', id).catch((error) => {
          console.error("Failed to update comment in RAGFlow:", error)
        })
      }
    }

    return Response.json({ data: updatedComment })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to update comment:", error)
    return Response.json({ error: "Failed to update comment" }, { status: 500 })
  }
}
