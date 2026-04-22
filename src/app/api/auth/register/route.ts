import { hash } from "bcryptjs"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

// Force Node.js runtime for bcryptjs compatibility
export const runtime = 'nodejs'

/**
 * POST /api/auth/register
 * 用户注册
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // 验证必填字段
    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // 验证密码长度
    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return Response.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    // 创建用户
    const passwordHash = await hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || email.split("@")[0],
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    // 为新用户创建默认 AI 配置
    await prisma.aiConfig.create({
      data: {
        userId: user.id,
        openaiBaseUrl: process.env.OPENAI_BASE_URL || "http://localhost:4000",
        openaiApiKey: process.env.OPENAI_API_KEY || "",
        openaiModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        autoTagModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        ragflowBaseUrl: process.env.RAGFLOW_BASE_URL || "http://localhost:4154",
        ragflowApiKey: process.env.RAGFLOW_API_KEY || "",
        aiPersonality: "friendly",
      },
    })

    return Response.json({ data: user }, { status: 201 })
  } catch (error) {
    console.error("Registration error:", error)
    return Response.json(
      { error: "Registration failed" },
      { status: 500 }
    )
  }
}
