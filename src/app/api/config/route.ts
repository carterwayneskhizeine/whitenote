import { auth } from "@/lib/auth"
import { getAiConfig, updateAiConfig } from "@/lib/ai/config"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

/**
 * GET /api/config
 * 获取 AI 配置 (支持热更新)
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getAiConfig(session.user.id)

  // 隐藏敏感字段
  return Response.json({
    data: {
      ...config,
      openaiApiKey: config.openaiApiKey ? "***" : "",
      ragflowApiKey: config.ragflowApiKey ? "***" : "",
    },
  })
}

/**
 * PUT /api/config
 * 更新 AI 配置 (立即生效，无需重启)
 */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // 过滤允许更新的字段
    const allowedFields = [
      "openaiBaseUrl",
      "openaiApiKey",
      "openaiModel",
      "enableRag",
      "ragflowBaseUrl",
      "ragflowApiKey",
      "ragflowChatId",
      "ragflowDatasetId",
      "ragTimeFilterStart",
      "ragTimeFilterEnd",
      "enableAutoTag",
      "autoTagModel",
      "enableBriefing",
      "briefingModel",
      "briefingTime",
      "aiPersonality",
      "aiExpertise",
      "enableLinkSuggestion",
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const config = await updateAiConfig(session.user.id, updateData)

    return Response.json({
      data: {
        ...config,
        openaiApiKey: config.openaiApiKey ? "***" : "",
        ragflowApiKey: config.ragflowApiKey ? "***" : "",
      },
      message: "Configuration updated successfully. Changes take effect immediately.",
    })
  } catch (error) {
    console.error("Failed to update config:", error)
    return Response.json({ error: "Failed to update config" }, { status: 500 })
  }
}

/**
 * POST /api/config/test
 * 测试 RAGFlow 连接
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getAiConfig(session.user.id)

  try {
    // 测试 RAGFlow 连接
    const response = await fetch(
      `${config.ragflowBaseUrl}/api/v1/datasets`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.ragflowApiKey}`,
        },
      }
    )

    if (response.ok) {
      return Response.json({
        success: true,
        message: "RAGFlow connection successful",
      })
    } else {
      return Response.json({
        success: false,
        error: `RAGFlow returned status ${response.status}`,
      })
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    })
  }
}
