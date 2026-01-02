import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/config
 * 获取当前用户的 AI 配置
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let config = await prisma.aiConfig.findUnique({
    where: { userId: session.user.id },
  })

  // 如果不存在，创建默认配置
  if (!config) {
    config = await prisma.aiConfig.create({
      data: {
        userId: session.user.id,
        openaiBaseUrl: process.env.OPENAI_BASE_URL || "http://localhost:4000",
        openaiApiKey: process.env.OPENAI_API_KEY || "",
        openaiModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        autoTagModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        briefingModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        ragflowBaseUrl: process.env.RAGFLOW_BASE_URL || "http://localhost:4154",
        ragflowApiKey: process.env.RAGFLOW_API_KEY || "",
        ragflowChatId: process.env.RAGFLOW_CHAT_ID || "",
        ragflowDatasetId: process.env.RAGFLOW_DATASET_ID || "",
      },
    })
  }

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
 * 更新当前用户的 AI 配置
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

    const updateData: any = { userId: session.user.id }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const config = await prisma.aiConfig.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: updateData,
    })

    // 隐藏敏感字段
    return Response.json({
      data: {
        ...config,
        openaiApiKey: config.openaiApiKey ? "***" : "",
        ragflowApiKey: config.ragflowApiKey ? "***" : "",
      },
    })
  } catch (error) {
    console.error("Failed to update config:", error)
    return Response.json({ error: "Failed to update config" }, { status: 500 })
  }
}
