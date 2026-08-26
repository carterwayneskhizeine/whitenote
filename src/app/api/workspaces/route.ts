import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { provisionRAGFlowForWorkspace } from "@/lib/ragflow/provision"
import { getAiConfig } from "@/lib/ai/config"

// GET /api/workspaces - 获取用户的所有 Workspace
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspaces = await prisma.workspace.findMany({
      where: { userId: session.user.id },
    })

    // 按最近帖子活动时间排序（新帖/编辑都会更新 updatedAt），无帖子的排最后
    const lastActivity = await prisma.message.groupBy({
      by: ['workspaceId'],
      where: { workspaceId: { in: workspaces.map((w) => w.id) } },
      _max: { updatedAt: true },
    })

    const lastActiveAt = new Map(
      lastActivity
        .filter((a) => a.workspaceId)
        .map((a) => [a.workspaceId as string, a._max.updatedAt?.getTime() ?? 0])
    )

    workspaces.sort((a, b) => {
      const at = lastActiveAt.get(a.id) ?? 0
      const bt = lastActiveAt.get(b.id) ?? 0
      if (at !== bt) return bt - at
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    return Response.json({ data: workspaces })
  } catch (error) {
    console.error("[Workspaces API] Error fetching workspaces:", error)
    return Response.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    )
  }
}

// POST /api/workspaces - 创建新 Workspace
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, description } = await request.json()

    if (!name || name.trim().length === 0) {
      return Response.json(
        { error: "Workspace name is required" },
        { status: 400 }
      )
    }

    // 获取用户的 RAGFlow 配置（可选，不再强制要求）
    const config = await getAiConfig(session.user.id)

    // 自动创建 RAGFlow 资源（如果配置了的话）
    let datasetId: string | null = null
    let chatId: string | null = null

    if (config.ragflowBaseUrl && config.ragflowApiKey) {
      try {
        const result = await provisionRAGFlowForWorkspace(
          config.ragflowBaseUrl,
          config.ragflowApiKey,
          name,
          session.user.id
        )
        datasetId = result.datasetId
        chatId = result.chatId
        console.log(`[Workspaces API] Successfully provisioned RAGFlow for workspace: ${name}`)
      } catch (error) {
        // RAGFlow 创建失败不再阻止工作区创建，只记录错误
        console.error("[Workspaces API] Error provisioning RAGFlow:", error)
        console.warn("[Workspaces API] Workspace will be created without RAGFlow resources")
      }
    } else {
      console.log(`[Workspaces API] RAGFlow not configured, creating workspace without RAGFlow: ${name}`)
    }

    // 创建 Workspace 记录
    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        userId: session.user.id,
        ragflowDatasetId: datasetId,
        ragflowChatId: chatId,
      }
    })

    console.log(`[Workspaces API] Created workspace: ${workspace.id} for user: ${session.user.id}`)
    return Response.json({ data: workspace })
  } catch (error) {
    console.error("[Workspaces API] Error creating workspace:", error)
    return Response.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    )
  }
}
