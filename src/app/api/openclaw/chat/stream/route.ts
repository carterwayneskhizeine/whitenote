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
  try {
    const body = await request.json()
    const { sessionKey = 'main', content, attachments, log = false } = body

    if (!content) {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const token = getOpenClawToken()
    const gateway = createGlobalGateway(token)

    if (!gateway.isConnected) {
      gateway.start()
      await gateway.waitForConnection(15_000)
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (data: ChatStreamResponse) => {
          try {
            const sseData = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(sseData))
          } catch {
            // controller may be closed
          }
        }

        sendEvent({ type: 'start', sessionKey })

        let hasFinished = false

        const eventHandler = (eventFrame: { event: string; payload?: unknown }) => {
          if (hasFinished) return

          if (log) {
            console.log(`[OpenClaw Stream] Event: ${eventFrame.event}`)
          }

          if (eventFrame.event === 'chat') {
            const payload = eventFrame.payload as ChatEvent & {
              message?: { content?: Array<{ type?: string; text?: string; thinking?: string }> }
            }

            if (payload.sessionKey !== sessionKey) {
              return
            }

            if (payload.state === 'delta') {
              const msgContent = payload.message?.content
              if (Array.isArray(msgContent)) {
                const textFull = msgContent
                  .filter((b: any) => b.type === 'text' && b.text)
                  .map((b: any) => b.text)
                  .join('\n')
                const thinkingFull = msgContent
                  .filter((b: any) => b.type === 'thinking' && b.thinking)
                  .map((b: any) => b.thinking)
                  .join('\n')
                if (textFull) {
                  sendEvent({ type: 'content', runId: payload.runId, content: textFull, delta: textFull })
                }
                if (thinkingFull) {
                  sendEvent({ type: 'reasoning', runId: payload.runId, content: thinkingFull, delta: thinkingFull })
                }
              }
            } else if (payload.state === 'final') {
              hasFinished = true
              sendEvent({
                type: 'finish',
                runId: payload.runId,
                usage: payload.usage,
                stopReason: payload.stopReason,
              })
            } else if (payload.state === 'error') {
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

        gateway.on('event', eventHandler)

        const cleanup = () => {
          gateway.off('event', eventHandler)
          try {
            controller.close()
          } catch {
            // already closed
          }
        }

        const finishTimeout = setTimeout(() => {
          if (!hasFinished) {
            hasFinished = true
            sendEvent({ type: 'error', error: 'Stream timeout' })
            cleanup()
          }
        }, 600_000)
        finishTimeout.unref()

        gateway.sendMessage(sessionKey, content, attachments)
          .then(() => {
            // chat.send ack received — events will flow via the event handler
          })
          .catch((error: unknown) => {
            if (!hasFinished) {
              hasFinished = true
              clearTimeout(finishTimeout)
              sendEvent({
                type: 'error',
                error: error instanceof Error ? error.message : 'Failed to send message',
              })
              cleanup()
            }
          })

        // Watch for gateway disconnect to end stream
        const onDisconnected = () => {
          if (!hasFinished) {
            hasFinished = true
            clearTimeout(finishTimeout)
            sendEvent({ type: 'error', error: 'Gateway disconnected' })
            cleanup()
          }
        }
        gateway.once('close', onDisconnected)
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
