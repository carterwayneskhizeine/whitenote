import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch (error) {
    console.error("[Health Check] Database connection failed:", error)
  }

  return NextResponse.json(
    {
      status: dbOk ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks: { database: dbOk },
    },
    { status: dbOk ? 200 : 503 }
  )
}
