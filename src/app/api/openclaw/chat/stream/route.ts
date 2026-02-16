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

    // Ensure gateway is connected
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

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: ChatStreamResponse) => {
          const sseData = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(sseData))
        }

        // Send start event
        sendEvent({
          type: 'start',
          sessionKey,
        })

        let hasError = false
        let hasFinished = false

        // Set up event listener for this request
        const eventHandler = (eventFrame: { event: string; payload?: unknown }) => {
          console.log('[OpenClaw Stream] Received event:', eventFrame.event, 'payload:', JSON.stringify(eventFrame.payload)?.substring(0, 500))

          // Listen for 'chat' events (OpenClaw sends chat events, not chat.broadcast)
          if (eventFrame.event === 'chat') {
            const payload = eventFrame.payload as ChatEvent

            // Only process events for our session
            // Note: sessionKey in events may be "agent:main:main" when we send to "main"
            const eventSessionKey = payload.sessionKey
            const isMatch = eventSessionKey === sessionKey ||
                           eventSessionKey === `agent:${sessionKey}:${sessionKey}` ||
                           eventSessionKey?.endsWith(`:${sessionKey}`)

            if (!isMatch) {
              console.log('[OpenClaw Stream] Skipping event for different session:', eventSessionKey, 'ours:', sessionKey)
              return
            }

            console.log('[OpenClaw Stream] Chat event:', payload.state, 'runId:', payload.runId)

            if (payload.state === 'delta' && payload.message) {
              // Streaming content update
              const content = payload.message as { content?: Array<{ text?: string }> }
              if (content.content) {
                const textParts = content.content
                  .filter((part): part is { text: string } => typeof part.text === 'string')
                  .map(part => part.text)
                  .join('')

                sendEvent({
                  type: 'content',
                  runId: payload.runId,
                  delta: textParts,
                  content: textParts,
                })
              }
            } else if (payload.state === 'final') {
              // Stream finished
              hasFinished = true
              sendEvent({
                type: 'finish',
                runId: payload.runId,
                usage: payload.usage,
                stopReason: payload.stopReason,
              })
            } else if (payload.state === 'error') {
              // Error occurred
              hasError = true
              hasFinished = true
              sendEvent({
                type: 'error',
                error: payload.errorMessage || 'Unknown error',
              })
            } else if (payload.state === 'aborted') {
              // Stream was aborted
              hasFinished = true
              sendEvent({
                type: 'finish',
                runId: payload.runId,
                stopReason: 'aborted',
              })
            }
          }
        }

        // Register event handler
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
          // Send the message
          console.log('[OpenClaw Stream] Sending message to OpenClaw Gateway...')
          await gateway.sendMessage(sessionKey, content)
          console.log('[OpenClaw Stream] Message sent, waiting for response events...')

          // Wait for completion or timeout
          const timeoutMs = 120000 // 2 minutes
          const startTime = Date.now()
          let loopCount = 0

          while (!hasFinished && !hasError) {
            loopCount++
            if (loopCount % 50 === 0) {
              console.log('[OpenClaw Stream] Still waiting... loop:', loopCount, 'elapsed:', Date.now() - startTime, 'ms')
            }

            if (Date.now() - startTime > timeoutMs) {
              sendEvent({
                type: 'error',
                error: 'Stream timeout',
              })
              break
            }
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (error) {
          console.error('[OpenClaw Stream] Error:', error)
          sendEvent({
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to send message',
          })
        } finally {
          // Clean up
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
    console.error('[OpenClaw Stream] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
