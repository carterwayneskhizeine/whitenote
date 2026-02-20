import { NextRequest } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'
import type { ChatEvent, ChatStreamResponse } from '@/lib/openclaw/types'

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
    const { sessionKey = 'main', content } = body

    if (!content) {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
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

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: ChatStreamResponse) => {
          const sseData = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(sseData))
        }

        sendEvent({
          type: 'start',
          sessionKey,
        })

        let hasError = false
        let hasFinished = false

        const eventHandler = (eventFrame: { event: string; payload?: unknown }) => {
          if (eventFrame.event === 'agent') {
            const agentPayload = eventFrame.payload as {
              runId?: string
              sessionKey?: string
              stream?: string
              data?: unknown
            }

            const eventSessionKey = agentPayload.sessionKey
            const isMatch = eventSessionKey === sessionKey ||
                           eventSessionKey === `agent:${sessionKey}:${sessionKey}` ||
                           eventSessionKey?.endsWith(`:${sessionKey}`)

            if (!isMatch) {
              return
            }

            // 只发送 assistant 文本流
            if (agentPayload.stream === 'assistant') {
              const data = agentPayload.data as { text?: string; delta?: string } | undefined
              const text = data?.delta || data?.text || ''
              if (text) {
                sendEvent({
                  type: 'content',
                  runId: agentPayload.runId,
                  delta: text,
                  content: text,
                })
              }
            }
          }

          if (eventFrame.event === 'chat') {
            const payload = eventFrame.payload as ChatEvent

            const eventSessionKey = payload.sessionKey
            const isMatch = eventSessionKey === sessionKey ||
                           eventSessionKey === `agent:${sessionKey}:${sessionKey}` ||
                           eventSessionKey?.endsWith(`:${sessionKey}`)

            if (!isMatch) {
              return
            }

            if (payload.state === 'final') {
              hasFinished = true
              sendEvent({
                type: 'finish',
                runId: payload.runId,
                usage: payload.usage,
                stopReason: payload.stopReason,
              })
            } else if (payload.state === 'error') {
              hasError = true
              hasFinished = true
              sendEvent({
                type: 'error',
                error: payload.errorMessage || 'Unknown error',
              })
            } else if (payload.state === 'aborted') {
              hasFinished = true
              sendEvent({
                type: 'finish',
                runId: payload.runId,
                stopReason: 'aborted',
              })
            }
          }
        }

        if (!gateway) {
          sendEvent({
            type: 'error',
            error: 'Gateway not initialized',
          })
          controller.close()
          return
        }

        gateway.onEvent = eventHandler

        try {
          await gateway.sendMessage(sessionKey, content)

          const timeoutMs = 600000
          const startTime = Date.now()

          while (!hasFinished && !hasError) {
            if (Date.now() - startTime > timeoutMs) {
              sendEvent({
                type: 'error',
                error: 'Stream timeout',
              })
              break
            }
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        } catch (error) {
          sendEvent({
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to send message',
          })
        } finally {
          if (gateway) {
            gateway.onEvent = () => {}
          }
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
