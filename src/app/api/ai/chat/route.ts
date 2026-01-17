import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { buildSystemPrompt, callOpenAI } from "@/lib/ai/openai"
import { callRAGFlowWithChatId } from "@/lib/ai/ragflow"
import { getAiConfig } from "@/lib/ai/config"
import { NextRequest } from "next/server"
import { addTask } from "@/lib/queue"

/**
 * 从 RAGFlow 文档名称提取消息 ID
 * 例如: message_cmk73pxzu000ccgim9wb5f6bc.md -> cmk73pxzu000ccgim9wb5f6bc
 */
function extractMessageIdFromDocument(documentName: string): string | null {
  const match = documentName.match(/message_([a-z0-9]+)\.md$/i)
  return match ? match[1] : null
}

export const runtime = 'nodejs'

/**
 * POST /api/ai/chat
 * AI 聊天接口 (支持双提及模式: @goldierill | @ragflow)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { messageId, content, mode = 'goldierill' } = body
    // mode: 'goldierill' | 'ragflow'

    if (!messageId || !content) {
      return Response.json(
        { error: "messageId and content are required" },
        { status: 400 }
      )
    }

    // 获取消息上下文（数据隔离：用户只能对自己创建的消息使用 AI）
    const message = await prisma.message.findUnique({
      where: { id: messageId, authorId: session.user.id },
      include: { workspace: true },
    })

    if (!message) {
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    // 获取最新配置 (热更新，如果不存在会自动创建默认配置)
    const config = await getAiConfig(session.user.id)

    let aiResponse: string
    let references: Array<{ content: string; source: string }> | undefined
    let quotedMessageId: string | undefined

    if (mode === 'ragflow') {
      console.log('[AI Chat] RAGFlow mode requested', {
        messageId,
        hasRagflowChatId: !!message.workspace?.ragflowChatId,
        ragflowChatId: message.workspace?.ragflowChatId,
        hasBaseUrl: !!config.ragflowBaseUrl,
        hasApiKey: !!config.ragflowApiKey
      })

      // RAGFlow 模式：使用 Workspace 的 chatId 检索知识库
      if (!message.workspace?.ragflowChatId) {
        console.error('[AI Chat] Missing RAGFlow chat ID for workspace')
        return Response.json(
          { error: "Workspace RAGFlow not configured. 请先在设置中配置 RAGFlow API Key，然后创建新 Workspace。" },
          { status: 400 }
        )
      }

      if (!config.ragflowBaseUrl || !config.ragflowApiKey) {
        console.error('[AI Chat] Missing RAGFlow credentials in user config')
        return Response.json(
          { error: "请先在 AI 配置中设置 RAGFlow Base URL 和 API Key" },
          { status: 400 }
        )
      }

      const messages = [{ role: "user" as const, content }]

      console.log('[AI Chat] Calling RAGFlow...')

      try {
        const result = await callRAGFlowWithChatId(
          config.ragflowBaseUrl,
          config.ragflowApiKey,
          message.workspace.ragflowChatId,
          messages
        )

        console.log('[AI Chat] RAGFlow response received:', {
          contentLength: result.content.length,
          hasReferences: !!result.references,
          referenceCount: result.references?.length || 0
        })

        aiResponse = result.content
        references = result.references

        // 从 references 中提取第一个（最相关）的 messageId
        if (references && references.length > 0) {
          quotedMessageId = extractMessageIdFromDocument(references[0].source) || undefined
          console.log('[AI Chat] Extracted quoted message ID:', quotedMessageId)
        }
      } catch (error) {
        console.error('[AI Chat] RAGFlow call failed:', error)
        return Response.json(
          {
            error: error instanceof Error
              ? `RAGFlow 调用失败: ${error.message}`
              : "RAGFlow 调用失败",
            details: error instanceof Error ? error.stack : undefined
          },
          { status: 500 }
        )
      }
    } else {
      // OpenAI 模式（@goldierill）：直接使用 OpenAI，上下文仅为当前帖子
      const systemPrompt = await buildSystemPrompt(session.user.id)
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: `原文：${message.content}\n\n用户问题：${content}` },
      ]
      aiResponse = await callOpenAI({ userId: session.user.id, messages })
    }

    // 清理 AI 回复中的 [ID:0] 标记
    const cleanedResponse = aiResponse.replace(/\[ID:\d+\]/g, '').trim()

    // 保存 AI 回复（AI 评论的 authorId 为 null，包含引用）
    const comment = await prisma.comment.create({
      data: {
        content: cleanedResponse,
        messageId,
        isAIBot: true,
        quotedMessageId,
      },
      include: {
        quotedMessage: true,
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    })

    // AI 评论也需要自动打标签并推送到知识库
    // 注意：AI 评论的 authorId 为 null，所以使用消息作者的用户 ID
    // 检查 Workspace 的 enableAutoTag 配置
    const workspace = message.workspace
      ? await prisma.workspace.findUnique({
          where: { id: message.workspace.id },
          select: { enableAutoTag: true },
        })
      : null

    if (workspace?.enableAutoTag) {
      await addTask("auto-tag-comment", {
        userId: session.user.id,
        workspaceId: message.workspaceId, // Add workspaceId
        commentId: comment.id,
        contentType: 'comment',
      })
    } else if (message.workspaceId) {
      // 如果未启用自动打标签，直接同步到 RAGFlow
      await addTask("sync-ragflow", {
        userId: session.user.id,
        workspaceId: message.workspaceId,
        messageId: comment.id, // Should be commentId for sync-ragflow
        contentType: 'comment',
      })
    }

    return Response.json({
      data: { comment, references },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[AI Chat] Auth error:', error.message)
      return Response.json({ error: error.message }, { status: 401 })
    }

    console.error('[AI Chat] Unexpected error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    })

    return Response.json(
      {
        error: error instanceof Error ? error.message : "AI service error",
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      { status: 500 }
    )
  }
}
