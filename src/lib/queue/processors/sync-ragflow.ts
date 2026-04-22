import type { Job } from "@/lib/queue/types"
import prisma from "@/lib/prisma"
import { syncToRAGFlowWithDatasetId } from "@/lib/ai/ragflow"

interface SyncRAGFlowJobData {
  userId: string
  workspaceId: string
  messageId: string
  contentType?: 'message' | 'comment'
}

export async function processSyncRAGFlow(job: Job<SyncRAGFlowJobData>) {
  const { userId, workspaceId, messageId, contentType = 'message' } = job.data

  console.log(`[SyncRAGFlow] Processing ${contentType}: ${messageId} (workspace: ${workspaceId})`)

  // 获取 Workspace 的 datasetId
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ragflowDatasetId: true }
  })

  if (!workspace?.ragflowDatasetId) {
    console.warn(`[SyncRAGFlow] Workspace ${workspaceId} has no RAGFlow dataset, skipping sync`)
    return
  }

  // 获取用户的 RAGFlow 配置
  const config = await prisma.aiConfig.findUnique({
    where: { userId },
    select: { ragflowBaseUrl: true, ragflowApiKey: true }
  })

  if (!config?.ragflowBaseUrl || !config.ragflowApiKey) {
    console.warn(`[SyncRAGFlow] User ${userId} has no RAGFlow config, skipping sync`)
    return
  }

  if (contentType === 'message') {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
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

    if (message) {
      // 如果有标签，格式化标签放在内容开头
      let contentWithTags = message.content
      if (message.tags.length > 0) {
        const tagLine = message.tags.map((t) => `#${t.tag.name}`).join(' ')
        contentWithTags = `${tagLine}\n\n${message.content}`
      }

      console.log("[SyncRAGFlow] Message medias count:", message.medias.length)
      console.log("[SyncRAGFlow] Message medias:", JSON.stringify(message.medias))

      await syncToRAGFlowWithDatasetId(
        config.ragflowBaseUrl,
        config.ragflowApiKey,
        workspace.ragflowDatasetId,
        messageId,
        contentWithTags,
        message.medias
      )
    }
  } else {
    // 处理评论
    const comment = await prisma.comment.findUnique({
      where: { id: messageId },
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

    if (comment) {
      // 如果有标签，格式化标签放在内容开头
      let contentWithTags = comment.content
      if (comment.tags.length > 0) {
        const tagLine = comment.tags.map((t) => `#${t.tag.name}`).join(' ')
        contentWithTags = `${tagLine}\n\n${comment.content}`
      }

      await syncToRAGFlowWithDatasetId(
        config.ragflowBaseUrl,
        config.ragflowApiKey,
        workspace.ragflowDatasetId,
        messageId,
        contentWithTags,
        comment.medias
      )
    }
  }

  console.log(`[SyncRAGFlow] Completed for ${contentType}: ${messageId}`)
}
