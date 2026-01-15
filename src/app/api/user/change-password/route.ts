import { hash, compare } from "bcryptjs"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

// Force Node.js runtime for bcryptjs compatibility
export const runtime = 'nodejs'

/**
 * POST /api/user/change-password
 * 修改用户密码
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    // 验证必填字段
    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      )
    }

    // 验证新密码长度
    if (newPassword.length < 6) {
      return Response.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // 获取用户当前密码
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      return Response.json(
        { error: "User not found or no password set" },
        { status: 404 }
      )
    }

    // 验证当前密码
    const isValid = await compare(currentPassword, user.passwordHash)
    if (!isValid) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      )
    }

    // 哈希新密码
    const newPasswordHash = await hash(newPassword, 12)

    // 更新密码
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Change password error:", error)
    return Response.json(
      { error: "Failed to change password" },
      { status: 500 }
    )
  }
}
