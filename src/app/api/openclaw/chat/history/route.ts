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
  let gateway: ReturnType<typeof createGlobalGateway> | null = null

  try {
    const { searchParams } = new URL(request.url)
    const sessionKey = searchParams.get('sessionKey') || 'main'
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    const token = getOpenClawToken()
    //console.log('[OpenClaw Chat History] Token:', token?.substring(0, 8) + '...')
    gateway = createGlobalGateway(token)
    //console.log('[OpenClaw Chat History] Gateway connected:', gateway.isConnected)
    
    // Only start if not already connected
    if (!gateway.isConnected) {
      gateway.start()
      
      // Wait for connection with proper timeout
      const maxWaitMs = 15000
      const startTime = Date.now()
      
      await new Promise<void>((resolve, reject) => {
        const checkConnection = setInterval(() => {
          if (gateway && gateway.isConnected) {
            clearInterval(checkConnection)
            resolve()
          } else if (Date.now() - startTime > maxWaitMs) {
            clearInterval(checkConnection)
            reject(new Error('Connection timeout'))
          }
        }, 100)
      })
    }

    //console.log('[OpenClaw Chat History] Calling chatHistory:', sessionKey, limit)
    const result = await gateway.chatHistory(sessionKey, limit)
    //console.log('[OpenClaw Chat History] Result:', result)

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
