import { requireAuth, AuthError } from "@/lib/api-auth"
import { getAiConfig, updateAiConfig, UserNotFoundError } from "@/lib/ai/config"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

/**
 * 获取配置时对敏感字段进行掩码处理
 * 如果密钥已设置，返回 "***" 表示已存在（但不显示实际值）
 * 如果密钥未设置，返回 ""
 */
function maskApiKey(key: string | null): string {
  return key ? "***" : ""
}

/**
 * GET /api/config
 * 获取 AI 配置 (支持热更新)
 * 敏感字段（API 密钥）已被加密存储，此处返回 "***" 表示已设置
 */
export async function GET() {
  try {
    const session = await requireAuth()
    const config = await getAiConfig(session.user.id)

  // 敏感字段掩码：已设置显示 "***"，未设置显示 ""
  return Response.json({
    data: {
      ...config,
      openaiApiKey: maskApiKey(config.openaiApiKey),
      ragflowApiKey: maskApiKey(config.ragflowApiKey),
      asrApiKey: maskApiKey(config.asrApiKey),
    },
  })
  } catch (error) {
    if (error instanceof AuthError || error instanceof UserNotFoundError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    // 不要直接抛出错误，避免泄露内部实现细节
    console.error("Failed to get config:", error)
    return Response.json({ error: "Failed to retrieve configuration" }, { status: 500 })
  }
}

/**
 * PUT /api/config
 * 更新 AI 配置 (立即生效，无需重启)
 * 敏感字段会自动加密存储
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth()

    const body = await request.json()

    // 过滤允许更新的字段
    const allowedFields = [
      "openaiBaseUrl",
      "openaiApiKey",
      "openaiModel",
      "ragflowBaseUrl",
      "ragflowApiKey",
      "ragTimeFilterStart",
      "ragTimeFilterEnd",
      "autoTagModel",
      "briefingModel",
      "briefingTime",
      "aiPersonality",
      "aiExpertise",
      "enableLinkSuggestion",
      "enableMdSync",
      "mdSyncDir",
      "asrApiKey",
      "asrApiUrl",
      "shareCommentsOrderNewestFirst",
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
        openaiApiKey: maskApiKey(config.openaiApiKey),
        ragflowApiKey: maskApiKey(config.ragflowApiKey),
        asrApiKey: maskApiKey(config.asrApiKey),
      },
      message: "Configuration updated successfully. Changes take effect immediately.",
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof UserNotFoundError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to update config:", error)

    // 提供更友好的错误消息，不暴露内部实现
    const errorMessage = error instanceof Error && error.message.includes('encrypt')
      ? "Encryption failed. Please check server configuration."
      : "Failed to update configuration"

    return Response.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * POST /api/config/test
 * 测试 RAGFlow 连接
 */
export async function POST() {
  try {
    const session = await requireAuth()
    const config = await getAiConfig(session.user.id)

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
        error: `Connection test failed with status ${response.status}`,
      })
    }
  } catch (error) {
    if (error instanceof AuthError || error instanceof UserNotFoundError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("RAGFlow connection test failed:", error)
    return Response.json({
      success: false,
      error: "Connection test failed. Please check your RAGFlow configuration.",
    })
  }
}
