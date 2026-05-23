import { requireAuth, AuthError } from "@/lib/api-auth"
import { searchRAG } from "@/lib/ai/rag"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

/**
 * POST /api/ai/search
 * RAG semantic search
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { query, workspaceId, mode = 'semantic', limit = 10 } = body

    if (!query || !workspaceId) {
      return Response.json({ error: "query and workspaceId are required" }, { status: 400 })
    }

    const results = await searchRAG(session.user.id, workspaceId, query, { mode, limit })

    return Response.json({ data: results })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("[Search] Error:", error)
    return Response.json({ error: "Search failed" }, { status: 500 })
  }
}
