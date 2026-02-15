const API_BASE = '/api/openclaw'

export interface SessionResponse {
  key: string
  sessionId: string
}

export interface ChatStreamEvent {
  type: 'start' | 'content' | 'finish' | 'error'
  sessionKey?: string
  delta?: string
  toolCalls?: unknown[]
  usage?: unknown
  stopReason?: string
  message?: string
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

function isSystemMessage(content: unknown): boolean {
  if (typeof content !== 'string') return false
  return content.includes('System:') || 
         content.includes('Conversation info') ||
         content.includes('Called the Read tool') ||
         content.includes('Called the') ||
         content.startsWith('[Sat') ||
         content.startsWith('[Sun') ||
         content.startsWith('[Mon') ||
         content.startsWith('[Tue') ||
         content.startsWith('[Wed') ||
         content.startsWith('[Thu') ||
         content.startsWith('[Fri') ||
         content.includes('Reasoning STREAM')
}

function formatToolCall(item: { type?: string; name?: string; arguments?: Record<string, unknown> }): string {
  const name = item.name || 'unknown'
  const args = item.arguments || {}
  const formatted = Object.entries(args)
    .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
    .join(',')
  return `toolCall ${name} ${formatted}`
}

function simplifyContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  
  if (!Array.isArray(content)) {
    return JSON.stringify(content)
  }

  const parts: string[] = []
  
  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    
    const obj = item as { type?: string; text?: string; name?: string; arguments?: Record<string, unknown>; id?: string }
    const itemType = obj.type
    
    if (itemType === 'toolCall') {
      const toolName = obj.name || 'unknown'
      const toolId = obj.id || ''
      const args = obj.arguments || {}
      const argsStr = Object.entries(args)
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join(', ')
      parts.push(`🔧 **Tool Call**: ${toolName}${toolId ? ` (${toolId})` : ''}\n\`${argsStr}\``)
    } else if (obj.text) {
      parts.push(obj.text)
    }
  }
  
  return parts.join('\n')
}

function convertMessage(msg: unknown): ChatHistoryMessage | null {
  if (!msg || typeof msg !== 'object') return null
  
  const m = msg as { role?: string; content?: unknown; timestamp?: number }
  
  if (m.role !== 'user' && m.role !== 'assistant') return null
  
  const rawContent = m.content
  if (isSystemMessage(rawContent)) return null
  
  const content = simplifyContent(rawContent)
  if (!content.trim()) return null
  
  return {
    role: m.role,
    content,
    timestamp: m.timestamp,
  }
}

export const openclawApi = {
  async getHistory(sessionKey: string = 'main', limit?: number): Promise<ChatHistoryMessage[]> {
    const params = new URLSearchParams({ sessionKey })
    if (limit) params.append('limit', limit.toString())

    const response = await fetch(`${API_BASE}/chat/history?${params}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get history')
    }

    const data = await response.json()
    const messages = (data.messages || []) as unknown[]
    const converted: ChatHistoryMessage[] = []
    
    for (const msg of messages) {
      const convertedMsg = convertMessage(msg)
      if (convertedMsg) {
        converted.push(convertedMsg)
      }
    }
    
    return converted
  },

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
