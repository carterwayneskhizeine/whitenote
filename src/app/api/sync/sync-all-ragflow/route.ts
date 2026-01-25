import { requireAuth, AuthError } from "@/lib/api-auth"
import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { syncToRAGFlowWithDatasetId } from "@/lib/ai/ragflow"
import { getAiConfig } from "@/lib/ai/config"

/**
 * POST /api/sync/sync-all-ragflow
 * Sync all messages and comments from DB to RAGFlow knowledge base
 * Useful for migrating to a new RAGFlow server
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Get user's AI config
    const config = await getAiConfig(userId)

    if (!config.ragflowBaseUrl || !config.ragflowApiKey) {
      return Response.json(
        { error: "RAGFlow 配置不完整，请先配置 Base URL 和 API Key" },
        { status: 400 }
      )
    }

    // Get all workspaces with RAGFlow dataset IDs
    const workspaces = await prisma.workspace.findMany({
      where: {
        userId,
        ragflowDatasetId: { not: null },
      },
      select: {
        id: true,
        name: true,
        ragflowDatasetId: true,
      },
    })

    if (workspaces.length === 0) {
      return Response.json(
        { error: "没有找到配置了 RAGFlow Dataset 的工作区" },
        { status: 400 }
      )
    }

    let messagesSynced = 0
    let commentsSynced = 0
    const errors: string[] = []

    // Sync all messages and comments for each workspace
    for (const workspace of workspaces) {
      try {
        // Get all messages in this workspace
        const messages = await prisma.message.findMany({
          where: {
            workspaceId: workspace.id,
          },
          select: {
            id: true,
            content: true,
            tags: {
              include: {
                tag: {
                  select: { name: true },
                },
              },
              orderBy: {
                tag: { name: 'asc' },
              },
            },
            medias: {
              select: {
                id: true,
                url: true,
                type: true,
              },
            },
          },
        })

        // Sync each message
        for (const message of messages) {
          try {
            // Format content with tags
            let contentWithTags = message.content
            if (message.tags.length > 0) {
              const tagLine = message.tags.map((t) => `#${t.tag.name}`).join(' ')
              contentWithTags = `${tagLine}\n\n${message.content}`
            }

            await syncToRAGFlowWithDatasetId(
              config.ragflowBaseUrl!,
              config.ragflowApiKey!,
              workspace.ragflowDatasetId!,
              message.id,
              contentWithTags,
              message.medias
            )
            messagesSynced++
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            errors.push(`Message ${message.id} in workspace ${workspace.name}: ${errorMsg}`)
            console.error(`[SyncAllRAGFlow] Failed to sync message ${message.id}:`, error)
          }
        }

        // Get all comments in this workspace
        const comments = await prisma.comment.findMany({
          where: {
            message: {
              workspaceId: workspace.id,
            },
          },
          select: {
            id: true,
            content: true,
            tags: {
              include: {
                tag: {
                  select: { name: true },
                },
              },
              orderBy: {
                tag: { name: 'asc' },
              },
            },
            medias: {
              select: {
                id: true,
                url: true,
                type: true,
              },
            },
          },
        })

        // Sync each comment
        for (const comment of comments) {
          try {
            // Format content with tags
            let contentWithTags = comment.content
            if (comment.tags.length > 0) {
              const tagLine = comment.tags.map((t) => `#${t.tag.name}`).join(' ')
              contentWithTags = `${tagLine}\n\n${comment.content}`
            }

            await syncToRAGFlowWithDatasetId(
              config.ragflowBaseUrl!,
              config.ragflowApiKey!,
              workspace.ragflowDatasetId!,
              comment.id,
              contentWithTags,
              comment.medias
            )
            commentsSynced++
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            errors.push(`Comment ${comment.id} in workspace ${workspace.name}: ${errorMsg}`)
            console.error(`[SyncAllRAGFlow] Failed to sync comment ${comment.id}:`, error)
          }
        }

        console.log(`[SyncAllRAGFlow] Completed workspace ${workspace.name}: ${messages.length} messages, ${comments.length} comments`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`Workspace ${workspace.name}: ${errorMsg}`)
        console.error(`[SyncAllRAGFlow] Failed to sync workspace ${workspace.name}:`, error)
      }
    }

    return Response.json({
      data: {
        workspacesSynced: workspaces.length,
        messagesSynced,
        commentsSynced,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `同步完成：${workspaces.length} 个工作区，${messagesSynced} 条消息，${commentsSynced} 条评论${errors.length > 0 ? `，${errors.length} 个错误` : ''}`,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to sync all to RAGFlow:", error)
    return Response.json(
      { error: "同步到 RAGFlow 失败" },
      { status: 500 }
    )
  }
}
