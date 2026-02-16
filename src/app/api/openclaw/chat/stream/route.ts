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
          // Log ALL events to understand the event structure
          console.log('[OpenClaw Stream] Event received:', eventFrame.event,
            'payload:', JSON.stringify(eventFrame.payload)?.substring(0, 800))

          // Handle 'agent' events - these contain streaming data including thinking, tool calls, etc.
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

            // Log different stream types
            if (agentPayload.stream === 'assistant') {
              console.log('[OpenClaw Stream] Agent assistant stream:', JSON.stringify(agentPayload.data)?.substring(0, 200))
            } else if (agentPayload.stream === 'thinking') {
              console.log('[OpenClaw Stream] Agent THINKING stream:', JSON.stringify(agentPayload.data)?.substring(0, 500))
              // Send thinking blocks to frontend
              const data = agentPayload.data as { text?: string } | undefined
              if (data?.text) {
                sendEvent({
                  type: 'content',
                  runId: agentPayload.runId,
                  contentBlocks: [{ type: 'thinking', thinking: data.text }],
                })
              }
            } else if (agentPayload.stream === 'toolCall') {
              console.log('[OpenClaw Stream] Agent TOOL CALL stream:', JSON.stringify(agentPayload.data)?.substring(0, 500))
              // Send tool calls to frontend
              const data = agentPayload.data as { name?: string; arguments?: Record<string, unknown>; id?: string } | undefined
              if (data?.name) {
                sendEvent({
                  type: 'content',
                  runId: agentPayload.runId,
                  contentBlocks: [{ type: 'toolCall', name: data.name, arguments: data.arguments, id: data.id }],
                })
              }
            }
          }

          // Handle 'chat' events - these contain the final aggregated message
          if (eventFrame.event === 'chat') {
            const payload = eventFrame.payload as ChatEvent

            // Only process events for our session
            // Note: sessionKey in events may be "agent:main:main" when we send to "main"
            const eventSessionKey = payload.sessionKey
            const isMatch = eventSessionKey === sessionKey ||
                           eventSessionKey === `agent:${sessionKey}:${sessionKey}` ||
                           eventSessionKey?.endsWith(`:${sessionKey}`)

            console.log('[OpenClaw Stream] Chat event - state:', payload.state, 'sessionKey:', eventSessionKey, 'match:', isMatch, 'runId:', payload.runId)

            if (!isMatch) {
              return
            }

            if (payload.state === 'delta' && payload.message) {
              // Streaming content update - send complete content blocks including thinking and tool calls
              const message = payload.message as {
                content?: Array<{
                  type?: string
                  text?: string
                  thinking?: string
                  thinkingSignature?: string
                  name?: string
                  arguments?: Record<string, unknown>
                  id?: string
                }>
              }

              if (message.content) {
                console.log('[OpenClaw Stream] Sending', message.content.length, 'content blocks')
                // Send all content blocks (thinking, toolCall, text)
                sendEvent({
                  type: 'content',
                  runId: payload.runId,
                  contentBlocks: message.content,
                })
              }
            } else if (payload.state === 'final') {
              // Stream finished
              console.log('[OpenClaw Stream] Final event received, runId:', payload.runId)
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
          await gateway.sendMessage(sessionKey, content)

          // Wait for completion or timeout
          const timeoutMs = 600000 // 10 minutes for long-running tasks
          const startTime = Date.now()

          while (!hasFinished && !hasError) {
            if (Date.now() - startTime > timeoutMs) {
              console.error('[OpenClaw Stream] Timeout after', timeoutMs / 1000, 'seconds')
              sendEvent({
                type: 'error',
                error: 'Stream timeout',
              })
              break
            }
            await new Promise(resolve => setTimeout(resolve, 50))
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
