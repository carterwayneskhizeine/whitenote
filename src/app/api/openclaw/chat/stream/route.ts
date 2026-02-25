import { NextRequest } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'
import type { ChatEvent, ChatStreamResponse } from '@/lib/openclaw/types'
import fs from 'fs'
import path from 'path'

function getOpenClawToken(): string {
  const token = process.env.OPENCLAW_TOKEN
  if (!token) {
    throw new Error('OPENCLAW_TOKEN is not configured')
  }
  return token
}

// ---- 事件日志 ----
const LOG_DIR = path.join(process.cwd(), 'logs')
let currentLogFile: string | null = null
let logStream: fs.WriteStream | null = null

function ensureLogFile() {
  if (logStream) return
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  currentLogFile = path.join(LOG_DIR, `openclaw-${ts}.jsonl`)
  logStream = fs.createWriteStream(currentLogFile, { flags: 'a' })
  console.log(`[OpenClaw Stream] Logging events to: ${currentLogFile}`)
}

function logEvent(label: string, data: unknown) {
  try {
    ensureLogFile()
    const line = JSON.stringify({ ts: new Date().toISOString(), label, data }) + '\n'
    logStream?.write(line)
  } catch { /* ignore log errors */ }
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let gateway: ReturnType<typeof createGlobalGateway> | null = null

  try {
    const body = await request.json()
    const { sessionKey = 'main', content, log = false } = body

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
          // 记录所有事件到文件
          if (log) {
            logEvent(eventFrame.event, eventFrame.payload)
          }

          if (eventFrame.event === 'chat') {
            const payload = eventFrame.payload as ChatEvent & {
              message?: { content?: Array<{ type?: string; text?: string; thinking?: string }> }
            }

            const eventSessionKey = payload.sessionKey
            const isMatch = eventSessionKey === sessionKey ||
                           eventSessionKey === `agent:${sessionKey}:${sessionKey}` ||
                           eventSessionKey?.endsWith(`:${sessionKey}`)

            if (!isMatch) {
              return
            }

            // chat.delta: 提取 text/thinking 内容快照（与 Dashboard 做法一致）
            if (payload.state === 'delta') {
              const msgContent = payload.message?.content
              if (Array.isArray(msgContent)) {
                const textFull = msgContent
                  .filter(b => b.type === 'text' && b.text)
                  .map(b => b.text!)
                  .join('\n')
                const thinkingFull = msgContent
                  .filter(b => b.type === 'thinking' && b.thinking)
                  .map(b => b.thinking!)
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
