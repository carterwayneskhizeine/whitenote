import { requireAuth, AuthError } from "@/lib/api-auth"
import { callOpenAI } from "@/lib/ai/openai"
import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = 'nodejs'

// Fallback prompts for built-in commands (in case database is not available)
const fallbackPrompts: Record<string, string> = {
  ask: '{content}',
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { action, content } = body

    if (!action || !content) {
      return Response.json(
        { error: "action and content are required" },
        { status: 400 }
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

    const result = await callOpenAI({
      userId: session.user.id,
      messages: [
        { role: "system", content: "你是一个专业的文本处理助手。" },
        { role: "user", content: prompt },
      ],
    })

    return Response.json({ data: { result } })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }

    console.error("AI enhance error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "AI service error" },
      { status: 500 }
    )
  }
}
