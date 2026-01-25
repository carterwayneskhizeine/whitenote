import { requireAuth, AuthError } from "@/lib/api-auth"
import { exportAllToLocal } from "@/lib/sync-utils"
import { NextRequest } from "next/server"
import redis from "@/lib/redis"

/**
 * POST /api/sync/export-all
 * Export all messages and comments from DB to local MD files
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

    // Pause file watcher to prevent feedback loop
    await redis.set("file-watcher:paused", "true", "EX", 300) // Auto-expire in 5 mins just in case

    const result = await exportAllToLocal(session.user.id)

    // Resume file watcher
    await redis.del("file-watcher:paused")

    return Response.json({
      data: result,
      message: `Exported ${result.messagesExported} messages and ${result.commentsExported} comments to local files.`
    })
  } catch (error) {
    // Ensure we resume file watcher even on error
    await redis.del("file-watcher:paused")
    
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to export to local:", error)
    return Response.json({ error: "Failed to export to local files" }, { status: 500 })
  }
}
