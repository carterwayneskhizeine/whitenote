import { requireAuth, AuthError } from "@/lib/api-auth"
import { exportAllToLocal } from "@/lib/sync-utils"
import { NextRequest } from "next/server"
import { setPaused, clearPaused } from "@/lib/file-watcher/pause-flag"

const PAUSE_KEY = "file-watcher:paused"

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    setPaused(PAUSE_KEY, 5 * 60 * 1000)
    const result = await exportAllToLocal(session.user.id)
    clearPaused(PAUSE_KEY)
    return Response.json({
      data: result,
      message: `Exported ${result.messagesExported} messages and ${result.commentsExported} comments to local files.`
    })
  } catch (error) {
    clearPaused(PAUSE_KEY)
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to export to local:", error)
    return Response.json({ error: "Failed to export to local files" }, { status: 500 })
  }
}
