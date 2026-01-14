import { handle401Error } from "@/lib/auth-redirect"

const API_BASE = "/api"

/**
 * 检查响应状态，如果是 401 则跳转到登录页
 */
async function handleResponse(response: Response): Promise<Response> {
  if (response.status === 401) {
    // 使用统一的错误处理函数
    handle401Error()
    throw new Error('Unauthorized')
  }
  return response
}

/**
 * 用户注册
 */
export async function register(data: {
  name?: string
  email: string
  password: string
}) {
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    await handleResponse(response)
    const result = await response.json()

    if (!response.ok) {
      return { error: result.error || "注册失败" }
    }

    return { data: result.data }
  } catch (error) {
    console.error("Register error:", error)
    if (error.message === 'Unauthorized') {
      throw error
    }
    return { error: "网络错误，请重试" }
  }
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`)

    await handleResponse(response)
    const result = await response.json()

    if (!response.ok) {
      return { error: result.error || "获取用户信息失败" }
    }

    return { data: result.data }
  } catch (error) {
    console.error("Get current user error:", error)
    if (error.message === 'Unauthorized') {
      throw error
    }
    return { error: "网络错误，请重试" }
  }
}

/**
 * 更新用户资料
 */
export async function updateProfile(data: {
  name?: string
  avatar?: string
}) {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    await handleResponse(response)
    const result = await response.json()

    if (!response.ok) {
      return { error: result.error || "更新资料失败" }
    }

    return { data: result.data }
  } catch (error) {
    console.error("Update profile error:", error)
    if (error.message === 'Unauthorized') {
      throw error
    }
    return { error: "网络错误，请重试" }
  }
}

export const authApi = {
  register,
  getCurrentUser,
  updateProfile,
}
