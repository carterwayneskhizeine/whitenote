import { requireAuth, AuthError } from "@/lib/api-auth"
import { reindexWorkspace } from "@/lib/ai/rag"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

/**
 * POST /api/ai/reindex
 * Full reindex of workspace content into sqlite-vec
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { workspaceId } = body

    if (!workspaceId) {
      return Response.json({ error: "workspaceId is required" }, { status: 400 })
    }

    const result = await reindexWorkspace(session.user.id, workspaceId)
    return Response.json({ data: result })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("[Reindex] Error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Reindex failed" },
      { status: 500 }
    )
  }
}
