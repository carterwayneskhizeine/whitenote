import { NextRequest, NextResponse } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'

function getOpenClawToken(): string {
  const token = process.env.OPENCLAW_TOKEN
  if (!token) {
    throw new Error('OPENCLAW_TOKEN is not configured')
  }
  return token
}

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionKey = searchParams.get('sessionKey') || 'main'
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    const token = getOpenClawToken()
    const gateway = createGlobalGateway(token)

    if (!gateway.isConnected) {
      gateway.start()
      await gateway.waitForConnection(15_000)
    }

    const result = await gateway.chatHistory(sessionKey, limit)

    return NextResponse.json({
      sessionKey: result.sessionKey,
      sessionId: result.sessionId,
      messages: result.messages,
    })
  } catch (error) {
    console.error('[OpenClaw Chat History] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get chat history' },
      { status: 500 }
    )
  }
}
