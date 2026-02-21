import { NextRequest, NextResponse } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'

function getOpenClawToken(): string {
  const token = process.env.OPENCLAW_TOKEN
  if (!token) {
    throw new Error('OPENCLAW_TOKEN is not configured')
  }
  return token
}

// GET - List all sessions
export async function GET(request: NextRequest) {
  try {
    const token = getOpenClawToken()
    const gateway = createGlobalGateway(token)

    if (!gateway.isConnected) {
      return NextResponse.json(
        { error: 'Gateway not connected' },
        { status: 503 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit')
    const activeMinutes = searchParams.get('activeMinutes')
    const includeLastMessage = searchParams.get('includeLastMessage') === 'true'

    const result = await gateway.request<{
      sessions: Array<{
        key: string
        kind: string
        updatedAt: number
        sessionId?: string
        label?: string
        flags?: string[]
        lastMessage?: string
      }>
      count: number
    }>('sessions.list', {
      limit: limit ? parseInt(limit, 10) : 50,
      activeMinutes: activeMinutes ? parseInt(activeMinutes, 10) : undefined,
      includeLastMessage,
      includeDerivedTitles: true,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[OpenClaw Sessions] List error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list sessions' },
      { status: 500 }
    )
  }
}

// POST - Create or resolve a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { label, createNew } = body

    const token = getOpenClawToken()
    const gateway = createGlobalGateway(token)

    if (!gateway.isConnected) {
      return NextResponse.json(
        { error: 'Gateway not connected' },
        { status: 503 }
      )
    }

    // If creating a new session, generate a unique session key
    let sessionKey: string
    if (createNew) {
      // Generate a unique session key using timestamp and random string
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 8)
      sessionKey = `agent:main:custom:${timestamp}-${random}`
    } else {
      // Try to resolve by label first, then fall back to main
      if (label) {
        try {
          const resolveResult = await gateway.request<{ key: string; sessionId: string }>(
            'sessions.resolve',
            { label, agentId: 'main' }
          )
          sessionKey = resolveResult.key
        } catch {
          // If resolve fails, create a new session with this label
          const timestamp = Date.now().toString(36)
          const random = Math.random().toString(36).substring(2, 8)
          sessionKey = `agent:main:custom:${timestamp}-${random}`
        }
      } else {
        sessionKey = 'main'
      }
    }

    // Set the label for the session
    if (label && sessionKey !== 'main') {
      try {
        await gateway.request('sessions.patch', {
          key: sessionKey,
          label,
        })
      } catch (patchError) {
        console.error('[OpenClaw Sessions] Failed to set label:', patchError)
      }
    }

    return NextResponse.json({
      key: sessionKey,
      sessionId: sessionKey,
      label,
    })
  } catch (error) {
    console.error('[OpenClaw Sessions] Create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 500 }
    )
  }
}
