import { NextRequest } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'
import type { EventFrame, ChatEvent } from '@/lib/openclaw/types'

function encodeSSELine(event: string, data: string) {
  return `event: ${event}\ndata: ${data}\n\n`
}

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
    const { sessionKey, content, label } = body

    if (!content) {
      return new Response(
        encodeSSELine('error', JSON.stringify({ message: 'content is required' })),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    const token = getOpenClawToken()
    gateway = createGlobalGateway(token)
    gateway.start()

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 15000)

      const checkConnection = setInterval(() => {
        if (gateway && gateway.isConnected) {
          clearInterval(checkConnection)
          clearTimeout(timeout)
          resolve()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkConnection)
      }, 500)
    })

    let currentSessionKey = sessionKey || 'main'

    if (!currentSessionKey) {
      throw new Error('Failed to get session key')
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              encodeSSELine('start', JSON.stringify({ sessionKey: currentSessionKey }))
            )
          )

          const originalOnEvent = gateway!.onEvent
          let currentRunId: string | undefined

          gateway!.onEvent = (event: EventFrame) => {
            // console.log('[OpenClaw Gateway] Event:', event.event, event.payload)
            
            // Handle agent stream (assistant content)
            if (event.event === 'agent') {
              const data = event.payload as { stream?: string; data?: { delta?: string; text?: string } }
              if (data.stream === 'assistant' && data.data?.delta) {
                controller.enqueue(
                  encoder.encode(
                    encodeSSELine('content', JSON.stringify({ delta: data.data.delta }))
                  )
                )
              }
              return
            }
            
            // Handle chat.event
            if (event.event === 'chat.event') {
              const chatEvent = event.payload as ChatEvent

              if (chatEvent.state === 'delta') {
                const msg = chatEvent.message as { delta?: string }
                if (msg?.delta) {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('content', JSON.stringify({ delta: msg.delta }))
                    )
                  )
                }
              } else if (chatEvent.state === 'final') {
                currentRunId = chatEvent.runId
                controller.enqueue(
                  encoder.encode(
                    encodeSSELine('finish', JSON.stringify({
                      usage: chatEvent.usage,
                      stopReason: chatEvent.stopReason,
                    }))
                  )
                )
              } else if (chatEvent.state === 'aborted') {
                controller.enqueue(
                  encoder.encode(
                    encodeSSELine('error', JSON.stringify({ message: 'Response aborted' }))
                  )
                )
              } else if (chatEvent.state === 'error') {
                controller.enqueue(
                  encoder.encode(
                    encodeSSELine('error', JSON.stringify({ message: chatEvent.errorMessage || 'Unknown error' }))
                  )
                )
              }
            }

            originalOnEvent?.(event)
          }

          await gateway!.sendMessage(currentSessionKey!, content)

        } catch (error) {
          console.error('[OpenClaw Chat Stream] Error:', error)
          controller.enqueue(
            encoder.encode(
              encodeSSELine(
                'error',
                JSON.stringify({
                  message: error instanceof Error ? error.message : 'AI service error',
                })
              )
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[OpenClaw Chat Stream] Error:', error)
    return new Response(
      encodeSSELine(
        'error',
        JSON.stringify({
          message: error instanceof Error ? error.message : 'AI service error',
        })
      ),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }
}
