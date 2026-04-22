import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { getAiConfig } from "@/lib/ai/config"

/**
 * GET /api/health/ragflow
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const config = await getAiConfig(session.user.id)

    const status = {
      ragflow: {
        connected: false,
        baseUrl: config.ragflowBaseUrl || null,
        error: null as string | null,
      },
      worker: {
        running: true,
        error: null as string | null,
      },
    }

    if (config.ragflowBaseUrl && config.ragflowApiKey) {
      try {
        const response = await fetch(`${config.ragflowBaseUrl}/api/v1/datasets`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${config.ragflowApiKey}` },
          signal: AbortSignal.timeout(5000),
        })
        if (response.ok) {
          status.ragflow.connected = true
        } else {
          status.ragflow.error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (error) {
        status.ragflow.error = error instanceof Error ? error.message : 'Unknown error'
      }
    } else {
      status.ragflow.error = 'RAGFlow not configured'
    }

    return NextResponse.json({ status })
  } catch (error) {
    console.error('[Health Check] Error:', error)
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
