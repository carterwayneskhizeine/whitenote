import { NextRequest, NextResponse } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'

function getOpenClawToken(): string {
  const token = process.env.OPENCLAW_TOKEN
  if (!token) {
    throw new Error('OPENCLAW_TOKEN is not configured')
  }
  return token
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionKey, label } = body

    const useSessionKey = sessionKey || 'main'

    return NextResponse.json({
      key: useSessionKey,
      sessionId: useSessionKey,
    })
  } catch (error) {
    console.error('[OpenClaw Sessions] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 500 }
    )
  }
}
