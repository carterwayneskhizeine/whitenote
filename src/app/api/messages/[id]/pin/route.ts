import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/messages/[id]/pin
 * 切换置顶状态
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  const message = await prisma.message.findUnique({
    where: { id },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  if (message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.message.update({
    where: { id },
    data: { isPinned: !message.isPinned },
    select: { id: true, isPinned: true },
  })

  return Response.json({ data: updated })
}
