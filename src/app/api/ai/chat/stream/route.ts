import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { buildSystemPrompt, callOpenAIStream } from "@/lib/ai/openai"
import { callRAGFlowWithChatIdStream } from "@/lib/ai/ragflow"
import { getAiConfig } from "@/lib/ai/config"
import { getCommentThreadContext } from "@/lib/ai/thread-context"
import { NextRequest } from "next/server"
import { addTask } from "@/lib/queue"

/**
 * 从 RAGFlow 文档名称提取消息 ID
 */
function extractMessageIdFromDocument(documentName: string): string | null {
  const match = documentName.match(/message_([a-z0-9]+)\.md$/i)
  return match ? match[1] : null
}

/**
 * SSE 辅助函数：编码 SSE 数据
 */
function encodeSSELine(event: string, data: string) {
  return `event: ${event}\ndata: ${data}\n\n`
}

export const runtime = 'nodejs'

/**
 * POST /api/ai/chat/stream
 * AI 聊天接口（流式模式，SSE 格式）
 */
export async function POST(request: NextRequest) {
  let commentId: string | null = null

  try {
    const session = await requireAuth()
    const body = await request.json()
    const { messageId, content, mode = 'goldierill' } = body

    if (!messageId || !content) {
      return new Response(
        encodeSSELine("error", JSON.stringify({ message: "messageId and content are required" })),
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        }
      )
    }

    // 获取消息上下文
    const message = await prisma.message.findUnique({
      where: { id: messageId, authorId: session.user.id },
      include: { workspace: true },
    })

    if (!message) {
      return new Response(
        encodeSSELine("error", JSON.stringify({ message: "Message not found" })),
        {
          status: 404,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        }
      )
    }

    // 在创建占位符前获取评论线程上下文（避免将占位符 "Thinking..." 纳入上下文）
    const threadContext = await getCommentThreadContext(messageId)

    // 创建空的 AI 评论（占位符）
    const placeholderComment = await prisma.comment.create({
      data: {
        content: "Thinking...",
        messageId,
        isAIBot: true,
      },
      include: {
        quotedMessage: true,
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
      },
    })

    commentId = placeholderComment.id

    // 发送评论创建事件
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送初始评论数据
          controller.enqueue(
            encoder.encode(
              encodeSSELine(
                "comment.created",
                JSON.stringify({
                  comment: placeholderComment,
                  messageId,
                })
              )
            )
          )

          let fullContent = ""
          let references: Array<{ content: string; source: string }> | undefined
          let quotedMessageId: string | undefined

          if (mode === 'ragflow') {
            // RAGFlow 流式模式
            const config = await getAiConfig(session.user.id)

            if (!message.workspace?.ragflowChatId) {
              controller.enqueue(
                encoder.encode(
                  encodeSSELine(
                    "error",
                    JSON.stringify({
                      message: "Workspace RAGFlow not configured. 请先在设置中配置 RAGFlow API Key，然后创建新 Workspace。"
                    })
                  )
                )
              )
              controller.close()
              return
            }

            if (!config.ragflowBaseUrl || !config.ragflowApiKey) {
              controller.enqueue(
                encoder.encode(
                  encodeSSELine(
                    "error",
                    JSON.stringify({
                      message: "请先在 AI 配置中设置 RAGFlow Base URL 和 API Key"
                    })
                  )
                )
              )
              controller.close()
              return
            }

            const messages = [{ role: "user" as const, content }]

            // 流式获取 RAGFlow 响应
            for await (const chunk of callRAGFlowWithChatIdStream(
              config.ragflowBaseUrl,
              config.ragflowApiKey,
              message.workspace.ragflowChatId,
              messages
            )) {
              if (chunk.content) {
                fullContent += chunk.content
                controller.enqueue(
                  encoder.encode(
                    encodeSSELine(
                      "content",
                      JSON.stringify({ text: chunk.content })
                    )
                  )
                )
              }
              if (chunk.references) {
                references = chunk.references
              }
            }

            // 从 references 中提取第一个（最相关）的 messageId
            if (references && references.length > 0) {
              quotedMessageId = extractMessageIdFromDocument(references[0].source) || undefined
            }
          } else {
            // OpenAI 流式模式（上下文包含完整评论线程）
            const systemPrompt = await buildSystemPrompt(session.user.id)
            const messages = [
              { role: "system" as const, content: systemPrompt },
              { role: "user" as const, content: `原文：${message.content}${threadContext}\n\n用户最新问题：${content}` },
            ]

            for await (const chunk of callOpenAIStream({ userId: session.user.id, messages })) {
              fullContent += chunk
              controller.enqueue(
                encoder.encode(
                  encodeSSELine(
                    "content",
                    JSON.stringify({ text: chunk })
                  )
                )
              )
            }
          }

          // 清理 AI 回复中的 [ID:0] 标记
          const cleanedResponse = fullContent.replace(/\[ID:\d+\]/g, '').trim()

          // 更新评论内容
          if (!commentId) {
            throw new Error('Comment ID not available')
          }

          const updatedComment = await prisma.comment.update({
            where: { id: commentId },
            data: {
              content: cleanedResponse,
              quotedMessageId,
            },
            include: {
              quotedMessage: true,
              tags: {
                include: {
                  tag: { select: { id: true, name: true, color: true } },
                },
              },
              author: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  email: true,
                },
              },
            },
          })

          // 发送完成事件
          controller.enqueue(
            encoder.encode(
              encodeSSELine(
                "comment.completed",
                JSON.stringify({
                  comment: updatedComment,
                  references,
                })
              )
            )
          )

          // AI 评论也需要自动打标签并推送到知识库
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
              commentId: commentId,
              contentType: 'comment',
            })
          } else if (message.workspaceId) {
            await addTask("sync-ragflow", {
              userId: session.user.id,
              workspaceId: message.workspaceId,
              messageId: commentId,
              contentType: 'comment',
            })
          }

          controller.close()
        } catch (error) {
          console.error('[AI Chat Stream] Error:', error)

          // 清理失败的占位符评论
          if (commentId) {
            try {
              await prisma.comment.delete({ where: { id: commentId } })
            } catch (e) {
              console.error('[AI Chat Stream] Failed to cleanup placeholder comment:', e)
            }
          }

          controller.enqueue(
            encoder.encode(
              encodeSSELine(
                "error",
                JSON.stringify({
                  message: error instanceof Error ? error.message : "AI service error",
                  type: error instanceof Error ? error.constructor.name : 'Unknown',
                })
              )
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(
        encodeSSELine("error", JSON.stringify({ message: error.message })),
        {
          status: 401,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        }
      )
    }

    console.error('[AI Chat Stream] Unexpected error:', error)

    // 清理失败的占位符评论
    if (commentId) {
      try {
        await prisma.comment.delete({ where: { id: commentId } })
      } catch (e) {
        console.error('[AI Chat Stream] Failed to cleanup placeholder comment:', e)
      }
    }

    return new Response(
      encodeSSELine(
        "error",
        JSON.stringify({
          message: error instanceof Error ? error.message : "AI service error",
        })
      ),
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      }
    )
  }
}
