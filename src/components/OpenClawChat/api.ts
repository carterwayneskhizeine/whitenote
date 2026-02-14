const API_BASE = '/api/openclaw'

export interface SessionResponse {
  key: string
  sessionId: string
}

export interface ChatStreamEvent {
  type: 'start' | 'content' | 'finish' | 'error'
  sessionKey?: string
  delta?: string
  usage?: unknown
  stopReason?: string
  message?: string
}

export const openclawApi = {
  async createSession(label?: string): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create session')
    }
    return response.json()
  },

  async *sendMessageStream(sessionKey: string, content: string, label?: string): AsyncGenerator<ChatStreamEvent> {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey, content, label }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to send message')
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEventType = 'message'

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue

        if (trimmedLine.startsWith('event: ')) {
          currentEventType = trimmedLine.slice(7).trim()
          continue
        }

        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6)
          try {
            const parsed = JSON.parse(data)
            yield { type: currentEventType, ...parsed }
          } catch {
            console.warn('[OpenClaw] Failed to parse SSE data:', data)
          }
        }
      }
    }
  },
}
