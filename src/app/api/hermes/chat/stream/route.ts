import { NextRequest, NextResponse } from 'next/server'

function getHermesBaseUrl(): string {
  return process.env.HERMES_API_URL || 'http://localhost:8642'
}

function getHermesApiKey(): string | undefined {
  return process.env.HERMES_API_KEY || undefined
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, sessionId } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing or invalid messages' },
        { status: 400 }
      )
    }

    const baseUrl = getHermesBaseUrl()
    const apiKey = getHermesApiKey()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    if (sessionId) {
      headers['X-Hermes-Session-Id'] = sessionId
    }

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'hermes-agent',
        messages,
        stream: true,
      }),
    })

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => upstream.statusText)
      console.error('[Hermes Proxy] Upstream error:', upstream.status, errText)
      return NextResponse.json(
        { error: `Hermes API error: ${upstream.status} ${errText}` },
        { status: upstream.status }
      )
    }

    if (!upstream.body) {
      return NextResponse.json(
        { error: 'No response body from Hermes' },
        { status: 502 }
      )
    }

    const responseSessionId = upstream.headers.get('X-Hermes-Session-Id')

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()

                if (data === '[DONE]') {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'finish' })}\n\n`)
                  )
                  continue
                }

                try {
                  const parsed = JSON.parse(data)
                  const choice = parsed.choices?.[0]

                  if (choice?.delta?.content) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'content',
                          delta: choice.delta.content,
                          content: choice.delta.content,
                        })}\n\n`
                      )
                    )
                  } else if (choice?.delta?.role) {
                    // role chunk, skip
                  } else if (choice?.finish_reason === 'stop') {
                    // finish chunk from Hermes — already handled by [DONE]
                  }
                } catch {
                  // skip unparseable lines
                }
              } else if (line.startsWith('event: ')) {
                const eventType = line.slice(7).trim()
                if (eventType === 'hermes.tool.progress') {
                  // Next line should be data
                  const nextLineIdx = lines.indexOf(line) + 1
                  const dataLine = lines[nextLineIdx]
                  if (dataLine?.startsWith('data: ')) {
                    try {
                      const toolData = JSON.parse(dataLine.slice(6))
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: 'tool_progress',
                            tool: toolData.tool,
                            emoji: toolData.emoji,
                            label: toolData.label,
                          })}\n\n`
                        )
                      )
                    } catch {
                      // skip
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('[Hermes Proxy] Stream error:', err)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`
            )
          )
        } finally {
          controller.close()
          reader.releaseLock()
        }
      },
    })

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
    if (responseSessionId) {
      responseHeaders['X-Hermes-Session-Id'] = responseSessionId
    }

    return new Response(stream, { headers: responseHeaders })
  } catch (error) {
    console.error('[Hermes Proxy] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
