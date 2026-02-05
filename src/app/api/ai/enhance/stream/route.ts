import { requireAuth, AuthError } from "@/lib/api-auth"
import { callOpenAIStream } from "@/lib/ai/openai"
import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = 'nodejs'

// Fallback prompts for built-in commands (in case database is not available)
const fallbackPrompts: Record<string, string> = {
  ask: '{content}',
}

/**
 * SSE 辅助函数：编码 SSE 数据
 */
function encodeSSELine(event: string, data: string) {
  return `event: ${event}\ndata: ${data}\n\n`
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { action, content } = body

    if (!action || !content) {
      return new Response(
        encodeSSELine("error", JSON.stringify({ message: "action and content are required" })),
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

    // Try to get the command from database first
    const promptTemplate = await prisma.aICommand.findFirst({
      where: {
        action,
        OR: [
          { isBuiltIn: true },
          { authorId: session.user.id },
        ],
      },
    })

    // Get prompt from database or use fallback
    const promptText = promptTemplate?.prompt || fallbackPrompts[action] || `{content}`

    // Replace {content} placeholder with actual content
    const prompt = promptText.replace(/\{content\}/g, content)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = ""

          for await (const chunk of callOpenAIStream({
            userId: session.user.id,
            messages: [
              { role: "system", content: "你是一个专业的文本处理助手。" },
              { role: "user", content: prompt },
            ],
          })) {
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

          // 发送完成事件
          controller.enqueue(
            encoder.encode(
              encodeSSELine(
                "done",
                JSON.stringify({ result: fullContent })
              )
            )
          )

          controller.close()
        } catch (error) {
          console.error('[AI Enhance Stream] Error:', error)
          controller.enqueue(
            encoder.encode(
              encodeSSELine(
                "error",
                JSON.stringify({
                  message: error instanceof Error ? error.message : "AI service error",
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
        "X-Accel-Buffering": "no",
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

    console.error('[AI Enhance Stream] Unexpected error:', error)
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
