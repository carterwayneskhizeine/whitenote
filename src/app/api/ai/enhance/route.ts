import { auth } from "@/lib/auth"
import { callOpenAI } from "@/lib/ai/openai"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

type EnhanceAction = "summarize" | "translate" | "expand" | "polish"

const prompts: Record<EnhanceAction, (content: string, target?: string) => string> = {
  summarize: (content) =>
    `请总结以下内容的要点，用简洁的中文回复：\n\n${content}`,
  translate: (content, target = "English") =>
    `请将以下内容翻译成 ${target}：\n\n${content}`,
  expand: (content) =>
    `请扩展以下简短内容，使其更加完整和详细：\n\n${content}`,
  polish: (content) =>
    `请润色以下内容，使其更加流畅和专业，保持原意：\n\n${content}`,
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, content, target } = body

    if (!action || !content) {
      return Response.json(
        { error: "action and content are required" },
        { status: 400 }
      )
    }

    if (!prompts[action as EnhanceAction]) {
      return Response.json(
        { error: "Invalid action" },
        { status: 400 }
      )
    }

    const prompt = prompts[action as EnhanceAction](content, target)

    const result = await callOpenAI({
      userId: session.user.id,
      messages: [
        { role: "system", content: "你是一个专业的文本处理助手。" },
        { role: "user", content: prompt },
      ],
    })

    return Response.json({ data: { result } })
  } catch (error) {
    console.error("AI enhance error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "AI service error" },
      { status: 500 }
    )
  }
}
