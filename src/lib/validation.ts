import { NextRequest } from "next/server"

/**
 * 解析分页参数
 */
export function getPaginationParams(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * 验证必填字段
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): string | null {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      return `Field '${String(field)}' is required`
    }
  }
  return null
}
