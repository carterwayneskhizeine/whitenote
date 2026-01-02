import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { buildSystemPrompt, callOpenAI } from "@/lib/ai/openai"
import { callRAGFlow } from "@/lib/ai/ragflow"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

/**
 * POST /api/ai/chat
 * AI 聊天接口 (配置热更新)
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { messageId, content } = body

    if (!messageId || !content) {
      return Response.json(
        { error: "messageId and content are required" },
        { status: 400 }
      )
    }

    // 获取消息上下文
    const message = await prisma.message.findUnique({
      where: { id: messageId, authorId: session.user.id },  // 数据隔离
      include: {
        comments: {
          orderBy: { createdAt: "asc" },
          take: 20,
        },
      },
    })

    if (!message) {
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    // 获取最新配置 (热更新)
    const config = await prisma.aiConfig.findUnique({
      where: { userId: session.user.id },
    })

    if (!config) {
      return Response.json({ error: "AI configuration not found" }, { status: 404 })
    }

    let aiResponse: string
    let references: Array<{ content: string; source: string }> | undefined

    if (config.enableRag && config.ragflowApiKey && config.ragflowChatId) {
      // RAG 模式
      const messages = [{ role: "user" as const, content }]
      const result = await callRAGFlow(session.user.id, messages)
      aiResponse = result.content
      references = result.references
    } else {
      // 标准模式
      const systemPrompt = await buildSystemPrompt(session.user.id)
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: `原文：${message.content}\n\n用户问题：${content}` },
      ]
      aiResponse = await callOpenAI({ userId: session.user.id, messages })
    }

    // 保存 AI 回复
    const comment = await prisma.comment.create({
      data: {
        content: aiResponse,
        messageId,
        isAIBot: true,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    })

    return Response.json({
      data: { comment, references },
    })
  } catch (error) {
    console.error("AI chat error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "AI service error" },
      { status: 500 }
    )
  }
}
