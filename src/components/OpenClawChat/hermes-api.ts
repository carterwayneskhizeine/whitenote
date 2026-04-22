const API_BASE = '/api/hermes'

export interface HermesSessionInfo {
  id: string
  source: string | null
  model: string | null
  title: string | null
  started_at: number
  ended_at: number | null
  last_active: number
  is_active: boolean
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  preview: string | null
}

export interface HermesSessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    function: { name: string; arguments: string }
  }>
  tool_name?: string
  tool_call_id?: string
  timestamp?: number
}

export interface HermesChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
  contentBlocks?: { type: 'toolCall' | 'text'; name?: string; arguments?: string; text?: string; id?: string }[]
}

function convertHermesMessage(msg: HermesSessionMessage): HermesChatHistoryMessage | null {
  if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) return null

  const contentBlocks: HermesChatHistoryMessage['contentBlocks'] = []
  const textParts: string[] = []

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      contentBlocks.push({
        type: 'toolCall',
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })
    }
  }

  if (msg.content) {
    contentBlocks.push({ type: 'text', text: msg.content })
    textParts.push(msg.content)
  }

  const content = textParts.join('\n')
  if (!content && contentBlocks.length === 0) return null

  return {
    role: msg.role as 'user' | 'assistant',
    content,
    timestamp: msg.timestamp,
    contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
  }
}

export const hermesApi = {
  async getHistory(sessionId: string): Promise<HermesChatHistoryMessage[]> {
    const res = await fetch(`${API_BASE}/chat/history?sessionId=${encodeURIComponent(sessionId)}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get history' }))
      throw new Error(err.error || 'Failed to get history')
    }
    const data = await res.json()
    const messages: HermesSessionMessage[] = data.messages || []
    const converted: HermesChatHistoryMessage[] = []
    for (const msg of messages) {
      const c = convertHermesMessage(msg)
      if (c) converted.push(c)
    }
    return converted
  },

  async sendMessageStream(
    sessionId: string | null,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    onChunk: (delta: string, fullContent: string) => void,
    onToolProgress: (tool: string, label: string) => void,
    onFinish: (newSessionId?: string) => void,
    onError: (error: string) => void,
  ): Promise<void> {
    const messages = [
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ]

    const body: Record<string, unknown> = { messages }
    if (sessionId) body.sessionId = sessionId

    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(err.error || 'Failed to send message')
    }

    const newSessionId = response.headers.get('X-Hermes-Session-Id') || undefined
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'content' && data.delta) {
              fullContent += data.delta
              onChunk(data.delta, fullContent)
            } else if (data.type === 'tool_progress') {
              onToolProgress(data.tool, data.label)
            } else if (data.type === 'finish') {
              onFinish(newSessionId)
              return
            } else if (data.type === 'error') {
              onError(data.error || 'Unknown error')
              return
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
      // Stream ended without finish event
      onFinish(newSessionId)
    } finally {
      reader.releaseLock()
    }
  },

  async listSessions(limit = 20, offset = 0): Promise<{ sessions: HermesSessionInfo[]; total: number }> {
    const res = await fetch(`${API_BASE}/sessions?limit=${limit}&offset=${offset}`)
    if (!res.ok) {
      throw new Error('Failed to list sessions')
    }
    return res.json()
  },

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) })
      return res.ok
    } catch {
      return false
    }
  },
}
