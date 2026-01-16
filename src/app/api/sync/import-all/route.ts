import { requireAuth, AuthError } from "@/lib/api-auth"
import { importAllFromLocal } from "@/lib/sync-utils"
import { NextRequest } from "next/server"

/**
 * POST /api/sync/import-all
 * Import all modified local MD files to DB and sync to RAGFlow
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

    const result = await importAllFromLocal()

    return Response.json({
      data: result,
      message: `Imported ${result.imported} files, skipped ${result.skipped}, errors: ${result.errors}`
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to import from local:", error)
    return Response.json({ error: "Failed to import from local files" }, { status: 500 })
  }
}
