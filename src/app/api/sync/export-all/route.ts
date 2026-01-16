import { requireAuth, AuthError } from "@/lib/api-auth"
import { exportAllToLocal } from "@/lib/sync-utils"
import { NextRequest } from "next/server"

/**
 * POST /api/sync/export-all
 * Export all messages and comments from DB to local MD files
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

    const result = await exportAllToLocal(session.user.id)

    return Response.json({
      data: result,
      message: `Exported ${result.messagesExported} messages and ${result.commentsExported} comments to local files.`
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to export to local:", error)
    return Response.json({ error: "Failed to export to local files" }, { status: 500 })
  }
}
