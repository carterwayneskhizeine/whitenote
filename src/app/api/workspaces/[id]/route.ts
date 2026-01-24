import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getAiConfig } from "@/lib/ai/config"

// PATCH /api/workspaces/[id] - 更新 Workspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, description, enableAutoTag, enableBriefing } = await request.json()

    // 验证 Workspace 是否存在且属于当前用户
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { id }
    })

    if (!existingWorkspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (existingWorkspace.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(enableAutoTag !== undefined && { enableAutoTag }),
        ...(enableBriefing !== undefined && { enableBriefing }),
      }
    })

    console.log(`[Workspaces API] Updated workspace: ${workspace.id}`)
    return Response.json({ data: workspace })
  } catch (error) {
    console.error("[Workspaces API] Error updating workspace:", error)
    return Response.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    )
  }
}

// DELETE /api/workspaces/[id] - 删除 Workspace（同时删除 RAGFlow 资源）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id }
    })

    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (workspace.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // 不允许删除默认 Workspace
    if (workspace.isDefault) {
      return Response.json(
        { error: "Cannot delete default workspace" },
        { status: 400 }
      )
    }

    const config = await getAiConfig(session.user.id)

    // 1. 删除 RAGFlow Dataset
    if (workspace.ragflowDatasetId && config.ragflowBaseUrl && config.ragflowApiKey) {
      try {
        await fetch(`${config.ragflowBaseUrl}/api/v1/datasets`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.ragflowApiKey}`
          },
          body: JSON.stringify({ ids: [workspace.ragflowDatasetId] })
        })
        console.log(`[Workspaces API] Deleted RAGFlow dataset: ${workspace.ragflowDatasetId}`)
      } catch (error) {
        console.error("[Workspaces API] Error deleting RAGFlow dataset:", error)
      }
    }

    // 2. 删除 RAGFlow Chat
    if (workspace.ragflowChatId && config.ragflowBaseUrl && config.ragflowApiKey) {
      try {
        await fetch(`${config.ragflowBaseUrl}/api/v1/chats`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.ragflowApiKey}`
          },
          body: JSON.stringify({ ids: [workspace.ragflowChatId] })
        })
        console.log(`[Workspaces API] Deleted RAGFlow chat: ${workspace.ragflowChatId}`)
      } catch (error) {
        console.error("[Workspaces API] Error deleting RAGFlow chat:", error)
      }
    }

    // 3. 删除数据库中的 Workspace（级联删除 Messages）
    await prisma.workspace.delete({
      where: { id }
    })

    console.log(`[Workspaces API] Deleted workspace: ${workspace.id}`)
    return Response.json({ success: true })
  } catch (error) {
    console.error("[Workspaces API] Error deleting workspace:", error)
    return Response.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    )
  }
}
