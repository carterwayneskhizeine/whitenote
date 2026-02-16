const API_BASE = '/api/openclaw'

export interface SessionResponse {
  key: string
  sessionId: string
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
  thinkingBlocks?: { type: 'thinking'; thinking: string; thinkingSignature?: string }[]
  contentBlocks?: { type: 'thinking' | 'toolCall' | 'text' | 'toolResult'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[]
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
  
  // Extract thinking blocks and preserve content blocks
  const thinkingBlocks: { type: 'thinking'; thinking: string; thinkingSignature?: string }[] = []
  const contentBlocks: { type: 'thinking' | 'toolCall' | 'text'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[] = []
  
  let content: string
  if (Array.isArray(rawContent)) {
    const parts: string[] = []
    for (const item of rawContent) {
      if (!item || typeof item !== 'object') continue
      const obj = item as { type?: string; text?: string; name?: string; arguments?: Record<string, unknown>; id?: string; thinking?: string; thinkingSignature?: string }
      
      // Preserve the block for later rendering
      if (obj.type === 'toolCall') {
        contentBlocks.push({
          type: 'toolCall',
          id: obj.id,
          name: obj.name,
          arguments: obj.arguments,
        })
        const toolName = obj.name || 'unknown'
        const args = obj.arguments || {}
        const argsStr = Object.entries(args)
          .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
          .join(', ')
        parts.push(`🔧 **Tool Call**: ${toolName}\n\`${argsStr}\``)
      } else if (obj.type === 'thinking') {
        contentBlocks.push({
          type: 'thinking',
          thinking: obj.thinking,
          thinkingSignature: obj.thinkingSignature,
        })
        if (obj.thinking) {
          thinkingBlocks.push({
            type: 'thinking',
            thinking: obj.thinking,
            thinkingSignature: obj.thinkingSignature,
          })
        }
      } else if (obj.text) {
        contentBlocks.push({
          type: 'text',
          text: obj.text,
        })
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
    thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : undefined,
    contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
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
      return null
    }

    const data = await response.json()
    let allMessages = (data.messages || []) as unknown[]
    
    console.log('[OpenClaw] pollMessage: total messages:', allMessages.length, 'afterTimestamp:', afterTimestamp)
    
    // Find the user message timestamp to filter
    let userTimestamp = afterTimestamp
    if (!userTimestamp && allMessages.length > 0) {
      // Find the last user message and use its timestamp
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i] as { role?: string; timestamp?: number }
        if (msg.role === 'user' && msg.timestamp) {
          userTimestamp = msg.timestamp
          break
        }
      }
    }
    
    console.log('[OpenClaw] pollMessage: userTimestamp:', userTimestamp)
    
    // Filter messages: user message, all assistant messages, and tool results after (or equal to) user timestamp
    // Also include toolResults that might have earlier timestamps than assistant messages
    const relevantMessages = allMessages.filter((m: unknown) => {
      const msg = m as { role?: string; timestamp?: number; runId?: string }
      // Include user messages
      if (msg.role === 'user' && msg.timestamp && userTimestamp && msg.timestamp >= userTimestamp) {
        return true
      }
      // Include assistant messages
      if (msg.role === 'assistant' && msg.timestamp && userTimestamp && msg.timestamp >= userTimestamp) {
        return true
      }
      // Include toolResult messages - they may have timestamps around or slightly before assistant messages
      if (msg.role === 'toolResult' && msg.timestamp && userTimestamp && msg.timestamp >= userTimestamp - 30000) {
        return true
      }
      return false
    }) as unknown[]
    
    console.log('[OpenClaw] pollMessage: relevant messages:', relevantMessages.length, 
      relevantMessages.map((m: any) => ({ role: m.role, timestamp: m.timestamp })))
    
    if (relevantMessages.length === 0) {
      return null
    }
    
    // Merge all assistant messages and tool results into one
    const mergedContentBlocks: { type: 'thinking' | 'toolCall' | 'text' | 'toolResult'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[] = []
    const mergedTextParts: string[] = []
    const mergedThinkingBlocks: { type: 'thinking'; thinking: string; thinkingSignature?: string }[] = []
    
    for (const msg of relevantMessages) {
      const m = msg as { role?: string; content?: unknown; timestamp?: number; name?: string; toolCallId?: string }
      
      // Skip user messages in the merge
      if (m.role === 'user') continue
      
      const rawContent = m.content
      
      // Handle toolResult messages
      if (m.role === 'toolResult') {
        let toolResultText = ''
        if (typeof rawContent === 'string') {
          toolResultText = rawContent
        } else if (Array.isArray(rawContent)) {
          for (const item of rawContent) {
            if (!item || typeof item !== 'object') continue
            const obj = item as { type?: string; text?: string }
            if (obj.type === 'toolResult' && obj.text) {
              toolResultText = obj.text
            } else if (obj.text) {
              toolResultText = obj.text
            }
          }
        }
        
        if (toolResultText) {
          mergedContentBlocks.push({
            type: 'toolResult' as const,
            id: m.toolCallId,
            name: m.name,
            text: toolResultText,
          })
          mergedTextParts.push(toolResultText)
        }
        continue
      }
      
      // Handle assistant messages
      if (Array.isArray(rawContent)) {
        for (const item of rawContent) {
          if (!item || typeof item !== 'object') continue
          const obj = item as { type?: string; text?: string; name?: string; arguments?: Record<string, unknown>; id?: string; thinking?: string; thinkingSignature?: string }
          
          if (obj.type === 'toolCall') {
            mergedContentBlocks.push({
              type: 'toolCall',
              id: obj.id,
              name: obj.name,
              arguments: obj.arguments,
            })
          } else if (obj.type === 'thinking') {
            mergedContentBlocks.push({
              type: 'thinking',
              thinking: obj.thinking,
              thinkingSignature: obj.thinkingSignature,
            })
            mergedThinkingBlocks.push({
              type: 'thinking',
              thinking: obj.thinking || '',
              thinkingSignature: obj.thinkingSignature,
            })
          } else if (obj.text) {
            mergedContentBlocks.push({
              type: 'text',
              text: obj.text,
            })
            mergedTextParts.push(obj.text)
          }
        }
      } else if (typeof rawContent === 'string' && rawContent.trim()) {
        mergedTextParts.push(rawContent)
      }
    }
    
    const mergedContent = mergedTextParts.join('\n\n')
    const lastTimestamp = relevantMessages.reduce((max: number, m: unknown) => {
      const msg = m as { timestamp?: number }
      return msg.timestamp && msg.timestamp > max ? msg.timestamp : max
    }, 0)
    
    return {
      role: 'assistant',
      content: mergedContent,
      timestamp: lastTimestamp || Date.now(),
      thinkingBlocks: mergedThinkingBlocks.length > 0 ? mergedThinkingBlocks : undefined,
      contentBlocks: mergedContentBlocks.length > 0 ? mergedContentBlocks : undefined,
    }
  },
}
