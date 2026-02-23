const API_BASE = '/api/openclaw'

export interface SessionResponse {
  key: string
  sessionId: string
}

import type {
  SessionListResponse,
  CreateSessionResponse,
  UpdateSessionResponse,
  DeleteSessionResponse,
} from './types'

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
  thinkingBlocks?: { type: 'thinking'; thinking: string; thinkingSignature?: string }[]
  contentBlocks?: { type: 'thinking' | 'toolCall' | 'text' | 'toolResult'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[]
}

function isSystemMessage(content: unknown): boolean {
  if (typeof content !== 'string') return false
  // Filter out messages that start with time stamps or contain "Conversation info"
  return content.startsWith('[Sat') ||
         content.startsWith('[Sun') ||
         content.startsWith('[Mon') ||
         content.startsWith('[Tue') ||
         content.startsWith('[Wed') ||
         content.startsWith('[Thu') ||
         content.startsWith('[Fri') ||
         content.includes('Reasoning STREAM') ||
         content.includes('Conversation info')
}

function cleanUserMessage(text: string): string {
  let cleaned = text

  // Remove "Conversation info (untrusted metadata):" section with JSON block
  cleaned = cleaned.replace(/Conversation info \(untrusted metadata\):\s*\n(?:\s*\n)?[\s\S]*?\n\n/g, '')

  // Remove JSON block (in case it's not caught by the above)
  cleaned = cleaned.replace(/```json\n[\s\S]*?```\n*/g, '')

  // Remove time stamp like [Sat 2026-02-21 15:28 GMT+8] or [Sat 2026-02-21 15:28 GMT+8]
  cleaned = cleaned.replace(/\[[A-Z][a-z]{2}\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\sGMT[+-]\d+\]\s*/g, '')

  // Remove any remaining empty lines
  cleaned = cleaned.replace(/^\s*\n/gm, '')

  return cleaned.trim()
}

function convertMessage(msg: unknown): ChatHistoryMessage | null {
  if (!msg || typeof msg !== 'object') return null

  const m = msg as { role?: string; content?: unknown; timestamp?: number }

  if (m.role !== 'user' && m.role !== 'assistant') return null

  const rawContent = m.content

  // Check if this is a system message BEFORE processing array content
  // For array content, we need to check if any text block contains system message patterns
  if (Array.isArray(rawContent)) {
    const hasSystemMessage = rawContent.some((item: unknown) => {
      if (!item || typeof item !== 'object') return false
      const obj = item as { type?: string; text?: string }
      return obj.type === 'text' && isSystemMessage(obj.text)
    })
    if (hasSystemMessage) {
      // Don't filter out entirely - we'll clean the text instead
    }
  } else if (isSystemMessage(rawContent)) {
    return null
  }

  const thinkingBlocks: { type: 'thinking'; thinking: string; thinkingSignature?: string }[] = []
  const contentBlocks: { type: 'thinking' | 'toolCall' | 'text'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[] = []

  let content: string
  const isUserMessage = m.role === 'user'

  if (Array.isArray(rawContent)) {
    const parts: string[] = []
    for (const item of rawContent) {
      if (!item || typeof item !== 'object') continue
      const obj = item as { type?: string; text?: string; name?: string; arguments?: Record<string, unknown>; id?: string; thinking?: string; thinkingSignature?: string }

      if (obj.type === 'toolCall') {
        contentBlocks.push({
          type: 'toolCall',
          id: obj.id,
          name: obj.name,
          arguments: obj.arguments,
        })
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
        // Clean user message text before adding to contentBlocks
        const cleanedText = isUserMessage ? cleanUserMessage(obj.text) : obj.text
        // Only add if there's content after cleaning
        if (cleanedText.trim()) {
          contentBlocks.push({
            type: 'text',
            text: cleanedText,
          })
          parts.push(cleanedText)
        }
      }
    }
    content = parts.join('\n')
  } else {
    content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
  }

  const hasContentBlocks = contentBlocks.length > 0
  if ((!content || !content.trim()) && !hasContentBlocks) return null

  // Clean content string for user messages (if not already cleaned)
  if (isUserMessage && (!hasContentBlocks || content)) {
    content = cleanUserMessage(content)
  }

  if ((!content || !content.trim()) && !hasContentBlocks) return null

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

    //console.log('[OpenClaw] Raw messages from gateway:', JSON.stringify(messages, null, 2))

    for (const msg of messages) {
      const convertedMsg = convertMessage(msg)
      if (convertedMsg) {
        converted.push(convertedMsg)
      }
    }

    //console.log('[OpenClaw] Converted messages:', converted)

    return converted
  },

  async getLastCompleteResponse(sessionKey: string = 'main'): Promise<ChatHistoryMessage | null> {
    const messages = await this.getAssistantMessages(sessionKey)
    if (messages.length === 0) return null
    return messages[messages.length - 1]
  },

  async getAssistantMessages(sessionKey: string = 'main', afterTimestamp?: number): Promise<ChatHistoryMessage[]> {
    const params = new URLSearchParams({ sessionKey })
    const response = await fetch(`${API_BASE}/chat/history?${params}`)
    if (!response.ok) {
      console.error('[OpenClaw] getAssistantMessages failed:', response.status)
      return []
    }

    const data = await response.json()
    const allMessages = (data.messages || []) as unknown[]

    let userTimestamp = afterTimestamp
    if (!userTimestamp && allMessages.length > 0) {
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i] as { role?: string; timestamp?: number }
        if (msg.role === 'user' && msg.timestamp) {
          userTimestamp = msg.timestamp
          break
        }
      }
    }

    if (!userTimestamp) return []

    const assistantMessages: ChatHistoryMessage[] = []
    let toolResults: { id?: string; name?: string; text: string; timestamp: number }[] = []

    const relevantMessages = allMessages.filter((m: unknown) => {
      const msg = m as { role?: string; timestamp?: number }
      if (msg.role === 'assistant' && msg.timestamp && msg.timestamp >= userTimestamp!) return true
      if (msg.role === 'toolResult' && msg.timestamp && msg.timestamp >= userTimestamp! - 30000) return true
      return false
    }) as unknown[]

    relevantMessages.sort((a: unknown, b: unknown) => {
      const tsA = (a as { timestamp?: number }).timestamp || 0
      const tsB = (b as { timestamp?: number }).timestamp || 0
      return tsA - tsB
    })

    for (const msg of relevantMessages) {
      const m = msg as { role?: string; content?: unknown; timestamp?: number; name?: string; toolCallId?: string }

      if (m.role === 'toolResult') {
        let toolResultText = ''
        let toolResultId = m.toolCallId
        if (typeof m.content === 'string') {
          toolResultText = m.content
        } else if (Array.isArray(m.content)) {
          for (const item of m.content) {
            if (!item || typeof item !== 'object') continue
            const obj = item as { type?: string; text?: string; id?: string }
            if (obj.text) {
              toolResultText = obj.text
              toolResultId = obj.id || toolResultId
            }
          }
        }
        if (toolResultText) {
          toolResults.push({ id: toolResultId, name: m.name, text: toolResultText, timestamp: m.timestamp || 0 })
        }
        continue
      }

      if (m.role === 'assistant') {
        const contentBlocks: { type: 'thinking' | 'toolCall' | 'text' | 'toolResult'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[] = []
        const thinkingBlocks: { type: 'thinking'; thinking: string; thinkingSignature?: string }[] = []
        const textParts: string[] = []

        const rawContent = m.content
        if (Array.isArray(rawContent)) {
          for (const item of rawContent) {
            if (!item || typeof item !== 'object') continue
            const obj = item as { type?: string; text?: string; name?: string; arguments?: Record<string, unknown>; id?: string; thinking?: string; thinkingSignature?: string }

            if (obj.type === 'toolCall') {
              contentBlocks.push({ type: 'toolCall', id: obj.id, name: obj.name, arguments: obj.arguments })
            } else if (obj.type === 'thinking') {
              contentBlocks.push({ type: 'thinking', thinking: obj.thinking, thinkingSignature: obj.thinkingSignature })
              if (obj.thinking) thinkingBlocks.push({ type: 'thinking', thinking: obj.thinking, thinkingSignature: obj.thinkingSignature })
            } else if (obj.text) {
              contentBlocks.push({ type: 'text', text: obj.text })
              textParts.push(obj.text)
            }
          }
        } else if (typeof rawContent === 'string' && rawContent.trim()) {
          contentBlocks.push({ type: 'text', text: rawContent })
          textParts.push(rawContent)
        }

        const matchingToolResults = toolResults.filter(tr => {
          const hasToolCall = contentBlocks.some(b => b.type === 'toolCall')
          if (!hasToolCall) return false
          const toolCallIds = contentBlocks.filter(b => b.type === 'toolCall').map(b => b.id)
          if (tr.id && toolCallIds.includes(tr.id)) return true
          return false
        })

        for (const tr of matchingToolResults) {
          contentBlocks.push({ type: 'toolResult', id: tr.id, name: tr.name, text: tr.text })
          textParts.push(tr.text)
        }

        assistantMessages.push({
          role: 'assistant',
          content: textParts.join('\n\n'),
          timestamp: m.timestamp,
          thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : undefined,
          contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
        })

        toolResults = toolResults.filter(tr => !matchingToolResults.includes(tr))
      }
    }

    return assistantMessages
  },

  async sendMessageStream(
    sessionKey: string,
    content: string,
    onChunk: (delta: string, fullContent: string) => void,
    onFinish: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey, content }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send message')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let accumulatedContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'start') {
                accumulatedContent = ''
              } else if (data.type === 'content') {
                // 只处理文本内容（流式）
                const delta = data.delta || data.content || ''
                accumulatedContent += delta
                onChunk(delta, accumulatedContent)
              } else if (data.type === 'finish') {
                onFinish()
                return
              } else if (data.type === 'error') {
                onError(data.error || 'Unknown error')
                return
              }
            } catch (e) {
              console.error('[OpenClaw] Failed to parse SSE data:', line, e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },

  // Session management methods
  async listSessions(limit?: number, activeMinutes?: number): Promise<SessionListResponse> {
    const params = new URLSearchParams()
    if (limit) params.append('limit', limit.toString())
    // Only append activeMinutes if it's defined (not undefined)
    // undefined means get all sessions, 0 or a number means filter by time
    if (activeMinutes !== undefined) params.append('activeMinutes', activeMinutes.toString())
    params.append('includeLastMessage', 'true')

    const response = await fetch(`${API_BASE}/sessions?${params}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to list sessions')
    }
    return response.json()
  },

  async createSession(label?: string, createNew?: boolean): Promise<CreateSessionResponse> {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, createNew }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create session')
    }
    return response.json()
  },

  async updateSession(sessionKey: string, label?: string): Promise<UpdateSessionResponse> {
    const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update session')
    }
    return response.json()
  },

  async deleteSession(sessionKey: string, deleteTranscript?: boolean): Promise<DeleteSessionResponse> {
    const params = new URLSearchParams()
    if (deleteTranscript) params.append('deleteTranscript', 'true')

    const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionKey)}?${params}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete session')
    }
    return response.json()
  },
}
