const API_BASE = '/api/openclaw'

export interface SessionResponse {
  key: string
  sessionId: string
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

export interface SendMessageResponse {
  messageId: string
  sessionKey: string
}

function isSystemMessage(content: unknown): boolean {
  if (typeof content !== 'string') return false
  return content.startsWith('[Sat') ||
         content.startsWith('[Sun') ||
         content.startsWith('[Mon') ||
         content.startsWith('[Tue') ||
         content.startsWith('[Wed') ||
         content.startsWith('[Thu') ||
         content.startsWith('[Fri') ||
         content.includes('Reasoning STREAM')
}

function cleanUserMessage(text: string): string {
  let cleaned = text
  
  // Remove "Conversation info (untrusted metadata):" block with JSON
  cleaned = cleaned.replace(/Conversation info \(untrusted metadata\):\s*```json\n[\s\S]*?```\n*/g, '')
  
  // Remove timestamp prefix like "[Mon 2026-02-16 12:14 GMT+8]"
  cleaned = cleaned.replace(/\[[A-Z][a-z]{2}\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+GMT[+-]\d+\]\s*/g, '')
  
  return cleaned.trim()
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
      const args = obj.arguments || {}
      const argsStr = Object.entries(args)
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join(', ')
      parts.push(`🔧 **Tool Call**: ${toolName}\n\`${argsStr}\``)
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
  
  let content: string
  if (Array.isArray(rawContent)) {
    const parts: string[] = []
    for (const item of rawContent) {
      if (!item || typeof item !== 'object') continue
      const obj = item as { type?: string; text?: string; name?: string; arguments?: Record<string, unknown>; id?: string }
      if (obj.type === 'toolCall') {
        const toolName = obj.name || 'unknown'
        const args = obj.arguments || {}
        const argsStr = Object.entries(args)
          .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
          .join(', ')
        parts.push(`🔧 **Tool Call**: ${toolName}\n\`${argsStr}\``)
      } else if (obj.type === 'thinking') {
        // Skip thinking in simplified view
      } else if (obj.text) {
        parts.push(obj.text)
      }
    }
    content = parts.join('\n')
  } else {
    content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
  }
  
  if (!content || !content.trim()) return null
  
  // Clean user messages to remove metadata and timestamp
  if (m.role === 'user') {
    content = cleanUserMessage(content)
  }
  
  if (!content || !content.trim()) return null
  
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

  async sendMessage(sessionKey: string, content: string): Promise<SendMessageResponse> {
    const response = await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey, content }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send message')
    }

    const data = await response.json()
    return {
      messageId: data.timestamp?.toString() || Date.now().toString(),
      sessionKey: data.sessionKey || sessionKey,
    }
  },

  async pollMessage(sessionKey: string, afterTimestamp?: number): Promise<ChatHistoryMessage | null> {
    const params = new URLSearchParams({ 
      sessionKey,
    })

    const response = await fetch(`${API_BASE}/chat/history?${params}`)
    if (!response.ok) {
      console.error('[OpenClaw] pollMessage failed:', response.status)
      // Return null on failure instead of throwing - allows chat to continue
      return null
    }

    const data = await response.json()
    let messages = (data.messages || []) as unknown[]
    
    // Filter: only assistant messages after user's timestamp
    if (afterTimestamp && messages.length) {
      messages = messages.filter((m: unknown) => {
        const msg = m as { role?: string; timestamp?: number }
        return msg.role === 'assistant' && msg.timestamp ? msg.timestamp > afterTimestamp : false
      })
    } else if (messages.length) {
      // No timestamp provided, just get latest assistant message
      messages = messages.filter((m: unknown) => {
        const msg = m as { role?: string }
        return msg.role === 'assistant'
      })
    }
    
    const latestMsg = messages[messages.length - 1]
    if (latestMsg) {
      return convertMessage(latestMsg)
    }
    return null
  },
}
