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

export async function POST(request: NextRequest) {
  let gateway: ReturnType<typeof createGlobalGateway> | null = null

  try {
    const body = await request.json()
    const { sessionKey, content } = body

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      )
    }

    const token = getOpenClawToken()
    gateway = createGlobalGateway(token)
    
    if (!gateway.isConnected) {
      gateway.start()
      
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

    await gateway.sendMessage(sessionKey || 'main', content)

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[OpenClaw Chat Send] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    )
  }
}
