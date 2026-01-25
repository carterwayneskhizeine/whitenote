import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getAiConfig } from "@/lib/ai/config"
import { provisionRAGFlowForWorkspace } from "@/lib/ragflow/provision"

export const runtime = 'nodejs'

/**
 * POST /api/workspaces/[id]/initialize-ragflow
 * 为现有 Workspace 初始化 RAGFlow 资源（Dataset 和 Chat）
 * 支持重新初始化（会删除旧的资源并创建新的）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. 验证 Workspace 存在且属于当前用户
    const workspace = await prisma.workspace.findUnique({
      where: { id }
    })

    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (workspace.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const isReinitializing = !!(workspace.ragflowDatasetId && workspace.ragflowChatId)

    // 2. 获取用户的 RAGFlow 配置
    const config = await getAiConfig(session.user.id)

    if (!config.ragflowBaseUrl || !config.ragflowApiKey) {
      return Response.json({
        error: "RAGFlow not configured. Please set RAGFlow Base URL and API Key in AI settings first."
      }, { status: 400 })
    }

    // 3. 如果是重新初始化，先删除旧的 RAGFlow 资源
    if (isReinitializing) {
      console.log(`[Workspaces API] Deleting old RAGFlow resources for workspace ${id}...`)

      // 删除旧的 Chat
      if (workspace.ragflowChatId) {
        try {
          await fetch(`${config.ragflowBaseUrl}/api/v1/chats/${workspace.ragflowChatId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${config.ragflowApiKey}` }
          })
          console.log(`[Workspaces API] Deleted old chat: ${workspace.ragflowChatId}`)
        } catch (error) {
          console.error(`[Workspaces API] Failed to delete old chat:`, error)
        }
      }

      // 删除旧的 Dataset
      if (workspace.ragflowDatasetId) {
        try {
          await fetch(`${config.ragflowBaseUrl}/api/v1/datasets/${workspace.ragflowDatasetId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${config.ragflowApiKey}` }
          })
          console.log(`[Workspaces API] Deleted old dataset: ${workspace.ragflowDatasetId}`)
        } catch (error) {
          console.error(`[Workspaces API] Failed to delete old dataset:`, error)
        }
      }
    }

    // 4. 调用 RAGFlow provision 函数
    const { datasetId, chatId } = await provisionRAGFlowForWorkspace(
      config.ragflowBaseUrl,
      config.ragflowApiKey,
      workspace.name,
      session.user.id
    )

    // 5. 更新 Workspace 记录
    const updatedWorkspace = await prisma.workspace.update({
      where: { id },
      data: {
        ragflowDatasetId: datasetId,
        ragflowChatId: chatId
      }
    })

    console.log(`[Workspaces API] ${isReinitializing ? 'Re-initialized' : 'Initialized'} RAGFlow for workspace ${id}: dataset=${datasetId}, chat=${chatId}`)

    return Response.json({
      success: true,
      data: {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        ragflowDatasetId: updatedWorkspace.ragflowDatasetId,
        ragflowChatId: updatedWorkspace.ragflowChatId
      }
    })
  } catch (error) {
    console.error("[Workspaces API] Error initializing RAGFlow:", error)
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to initialize RAGFlow resources"
      },
      { status: 500 }
    )
  }
}
