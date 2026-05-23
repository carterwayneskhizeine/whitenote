import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { buildSystemPrompt, callOpenAI } from "@/lib/ai/openai"
import { callRAGFlowWithChatId } from "@/lib/ai/ragflow"
import { getAiConfig } from "@/lib/ai/config"
import { getCommentThreadContext } from "@/lib/ai/thread-context"
import { searchRAG } from "@/lib/ai/rag"
import { NextRequest } from "next/server"
import { addTask } from "@/lib/queue"

function extractMessageIdFromDocument(documentName: string): string | null {
  const match = documentName.match(/message_([a-z0-9]+)\.md$/i)
  return match ? match[1] : null
}

export const runtime = 'nodejs'

/**
 * POST /api/ai/chat
 * AI 聊天接口 (支持双提及模式: @goldierill | @rag)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { messageId, content, mode = 'goldierill' } = body
    // mode: 'goldierill' | 'rag'

    if (!messageId || !content) {
      return Response.json(
        { error: "messageId and content are required" },
        { status: 400 }
      )
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId, authorId: session.user.id },
      include: { workspace: true },
    })

    if (!message) {
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    const config = await getAiConfig(session.user.id)

    let aiResponse: string
    let references: Array<{ content: string; source: string }> | undefined
    let quotedMessageId: string | undefined

    if (mode === 'rag') {
      // RAG mode: try sqlite-vec first, fallback to RAGFlow
      const hasEmbedding = !!config.embeddingApiKey

      if (hasEmbedding && message.workspaceId) {
        // sqlite-vec path (primary)
        console.log('[AI Chat] Using sqlite-vec RAG')

        const results = await searchRAG(session.user.id, message.workspaceId, content, { limit: 5 })
        const ragContext = results.map(r => `[Source: ${r.sourceId}]\n${r.content}`).join('\n---\n')

        const [systemPrompt] = await Promise.all([
          buildSystemPrompt(session.user.id),
        ])

        const ragSystemPrompt = `${systemPrompt}\n\n以下是从历史消息中检索到的相关内容（如果为空则没有找到相关内容）：\n${ragContext || '无'}\n\n请根据以上上下文回答用户问题。如果上下文中没有相关信息，请诚实说明。`

        const chatMessages = [
          { role: "system" as const, content: ragSystemPrompt },
          { role: "user" as const, content },
        ]
        aiResponse = await callOpenAI({ userId: session.user.id, messages: chatMessages })
        references = results.map(r => ({ content: r.content, source: r.sourceId }))
        if (results.length > 0) quotedMessageId = results[0].sourceId
      } else {
        // RAGFlow fallback
        console.log('[AI Chat] Using RAGFlow fallback', {
          hasEmbedding,
          hasWorkspaceId: !!message.workspaceId,
          hasRagflowChatId: !!message.workspace?.ragflowChatId,
        })

        if (!message.workspace?.ragflowChatId) {
          return Response.json(
            { error: "Workspace RAGFlow not configured. 请先配置 RAGFlow 或设置 Embedding API Key。" },
            { status: 400 }
          )
        }

        if (!config.ragflowBaseUrl || !config.ragflowApiKey) {
          return Response.json(
            { error: "请先在 AI 配置中设置 RAGFlow Base URL 和 API Key" },
            { status: 400 }
          )
        }

        const chatMessages = [{ role: "user" as const, content }]

        try {
          const result = await callRAGFlowWithChatId(
            config.ragflowBaseUrl,
            config.ragflowApiKey,
            message.workspace.ragflowChatId,
            chatMessages
          )

          aiResponse = result.content
          references = result.references

          if (references && references.length > 0) {
            quotedMessageId = extractMessageIdFromDocument(references[0].source) || undefined
          }
        } catch (error) {
          console.error('[AI Chat] RAGFlow call failed:', error)
          return Response.json(
            {
              error: error instanceof Error
                ? `RAGFlow 调用失败: ${error.message}`
                : "RAGFlow 调用失败",
            },
            { status: 500 }
          )
        }
      }
    } else {
      // OpenAI 模式（@goldierill）：使用 OpenAI，上下文包含完整评论线程
      const [systemPrompt, threadContext] = await Promise.all([
        buildSystemPrompt(session.user.id),
        getCommentThreadContext(messageId),
      ])
      const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: `原文：${message.content}${threadContext}\n\n用户最新问题：${content}` },
      ]
      aiResponse = await callOpenAI({ userId: session.user.id, messages: chatMessages })
    }

    // Clean AI response
    const cleanedResponse = aiResponse.replace(/\[ID:\d+\]/g, '').trim()

    // Save AI comment
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

    // Auto-tag AI comments if enabled (but NEVER sync AI comments to RAG)
    const workspace = message.workspace
      ? await prisma.workspace.findUnique({
          where: { id: message.workspace.id },
          select: { enableAutoTag: true },
        })
      : null

    if (workspace?.enableAutoTag) {
      await addTask("auto-tag-comment", {
        userId: session.user.id,
        workspaceId: message.workspaceId,
        commentId: comment.id,
        contentType: 'comment',
      })
    }
    // NOTE: AI comments are NOT synced to RAG (isAIBot filter in sync-rag processor)

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
    })

    return Response.json(
      { error: error instanceof Error ? error.message : "AI service error" },
      { status: 500 }
    )
  }
}
