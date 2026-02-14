import { NextRequest } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'
import type { EventFrame, ChatEvent, ChatBroadcastEvent } from '@/lib/openclaw/types'

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

function extractTextFromMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as { content?: unknown }
  if (!Array.isArray(msg.content) || msg.content.length === 0) return null
  const first = msg.content[0] as { text?: string } | undefined
  return first?.text ?? null
}

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
            // console.log('[OpenClaw Gateway] Event:', event.event, JSON.stringify(event.payload).slice(0, 200))
            
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
            
            // Handle chat.event (WebSocket style events)
            if (event.event === 'chat.event') {
              const chatEvent = event.payload as ChatEvent

              if (chatEvent.state === 'delta') {
                const text = extractTextFromMessage(chatEvent.message)
                if (text) {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('content', JSON.stringify({ delta: text }))
                    )
                  )
                }
              } else if (chatEvent.state === 'final') {
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
              return
            }

            // Handle chat (broadcast style events)
            if (event.event === 'chat') {
              const chatEvent = event.payload as ChatBroadcastEvent

              if (chatEvent.state === 'delta') {
                const text = extractTextFromMessage(chatEvent.message)
                if (text) {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('content', JSON.stringify({ delta: text }))
                    )
                  )
                }
              } else if (chatEvent.state === 'final') {
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
              return
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
