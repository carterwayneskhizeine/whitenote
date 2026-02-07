import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import redis from "@/lib/redis"

export async function GET() {
  const checks = {
    database: false,
    redis: false,
  }

  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    console.error("[Health Check] Database connection failed:", error)
  }

  try {
    // 检查 Redis 连接
    await redis.ping()
    checks.redis = true
  } catch (error) {
    console.error("[Health Check] Redis connection failed:", error)
  }

  const isHealthy = checks.database && checks.redis

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: isHealthy ? 200 : 503 }
  )
}
