import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/templates
 * 获取所有模板
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const templates = await prisma.template.findMany({
    where: {
      OR: [
        { isBuiltIn: true },
        { authorId: session.user.id },
      ],
    },
    orderBy: [
      { isBuiltIn: "desc" },
      { name: "asc" },
    ],
  })

  return Response.json({ data: templates })
}

/**
 * POST /api/templates
 * 创建自定义模板
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, content, description } = body

    if (!name || !content) {
      return Response.json(
        { error: "Name and content are required" },
        { status: 400 }
      )
    }

    const template = await prisma.template.create({
      data: {
        name: name.trim(),
        content: content.trim(),
        description: description?.trim() || null,
        authorId: session.user.id,
        isBuiltIn: false,
      },
    })

    return Response.json({ data: template }, { status: 201 })
  } catch (error) {
    console.error("Failed to create template:", error)
    return Response.json({ error: "Failed to create template" }, { status: 500 })
  }
}
