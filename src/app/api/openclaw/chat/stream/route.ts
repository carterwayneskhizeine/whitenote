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

function extractContentFromMessage(message: unknown): { text?: string; toolCalls?: unknown[] } | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as { content?: unknown }
  if (!Array.isArray(msg.content) || msg.content.length === 0) return null
  
  const result: { text?: string; toolCalls?: unknown[] } = {}
  const toolCalls: unknown[] = []
  
  for (const item of msg.content) {
    if (!item || typeof item !== 'object') continue
    const obj = item as { type?: string; text?: string }
    if (obj.type === 'toolCall') {
      toolCalls.push(item)
    } else if (obj.text) {
      result.text = (result.text || '') + obj.text
    }
  }
  
  if (toolCalls.length > 0) {
    result.toolCalls = toolCalls
  }
  
  return result.text || result.toolCalls ? result : null
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

    let currentSessionKey = sessionKey || 'main'

    if (!currentSessionKey) {
      throw new Error('Failed to get session key')
    }

    const encoder = new TextEncoder()
    let controllerClosed = false
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
            if (controllerClosed) return
            
            // Handle agent stream (assistant content)
            if (event.event === 'agent') {
              const data = event.payload as { stream?: string; data?: { delta?: string; text?: string } }
              if (data.stream === 'assistant' && data.data?.delta) {
                try {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('content', JSON.stringify({ delta: data.data.delta }))
                    )
                  )
                } catch {
                  controllerClosed = true
                }
              }
              return
            }
            
            // Handle chat.event (WebSocket style events)
            if (event.event === 'chat.event') {
              const chatEvent = event.payload as ChatEvent

              if (chatEvent.state === 'delta') {
                const content = extractContentFromMessage(chatEvent.message)
                if (content) {
                  const sseData: { delta?: string; toolCalls?: unknown[] } = {}
                  if (content.text) {
                    sseData.delta = content.text
                  }
                  if (content.toolCalls && content.toolCalls.length > 0) {
                    sseData.toolCalls = content.toolCalls
                  }
                  if (Object.keys(sseData).length > 0) {
                    try {
                      controller.enqueue(
                        encoder.encode(
                          encodeSSELine('content', JSON.stringify(sseData))
                        )
                      )
                    } catch {
                      controllerClosed = true
                    }
                  }
                }
              } else if (chatEvent.state === 'final') {
                try {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('finish', JSON.stringify({
                        usage: chatEvent.usage,
                        stopReason: chatEvent.stopReason,
                      }))
                    )
                  )
                } catch {
                  controllerClosed = true
                }
              } else if (chatEvent.state === 'aborted') {
                try {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('error', JSON.stringify({ message: 'Response aborted' }))
                    )
                  )
                } catch {
                  controllerClosed = true
                }
              } else if (chatEvent.state === 'error') {
                try {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('error', JSON.stringify({ message: chatEvent.errorMessage || 'Unknown error' }))
                    )
                  )
                } catch {
                  controllerClosed = true
                }
              }
              return
            }

            // Handle chat (broadcast style events)
            if (event.event === 'chat') {
              const chatEvent = event.payload as ChatBroadcastEvent

              if (chatEvent.state === 'delta') {
                const content = extractContentFromMessage(chatEvent.message)
                if (content) {
                  const sseData: { delta?: string; toolCalls?: unknown[] } = {}
                  if (content.text) {
                    sseData.delta = content.text
                  }
                  if (content.toolCalls && content.toolCalls.length > 0) {
                    sseData.toolCalls = content.toolCalls
                  }
                  if (Object.keys(sseData).length > 0) {
                    try {
                      controller.enqueue(
                        encoder.encode(
                          encodeSSELine('content', JSON.stringify(sseData))
                        )
                      )
                    } catch {
                      controllerClosed = true
                    }
                  }
                }
              } else if (chatEvent.state === 'final') {
                try {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('finish', JSON.stringify({
                        usage: chatEvent.usage,
                        stopReason: chatEvent.stopReason,
                      }))
                    )
                  )
                } catch {
                  controllerClosed = true
                }
              } else if (chatEvent.state === 'aborted') {
                try {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('error', JSON.stringify({ message: 'Response aborted' }))
                    )
                  )
                } catch {
                  controllerClosed = true
                }
              } else if (chatEvent.state === 'error') {
                try {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSELine('error', JSON.stringify({ message: chatEvent.errorMessage || 'Unknown error' }))
                    )
                  )
                } catch {
                  controllerClosed = true
                }
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
