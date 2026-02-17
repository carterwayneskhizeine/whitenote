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

    console.log('[OpenClaw] getAssistantMessages:', assistantMessages.length, 'messages')
    return assistantMessages
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

  async sendMessageStream(
    sessionKey: string,
    content: string,
    onChunk: (delta: string, fullContent: string, contentBlocks?: unknown[]) => void,
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
    let accumulatedContentBlocks: unknown[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'start') {
                // Stream started
                accumulatedContent = ''
                accumulatedContentBlocks = []
                console.log('[OpenClaw] Stream started')
              } else if (data.type === 'content') {
                // Content chunk - may have contentBlocks or delta/content
                if (data.contentBlocks) {
                  console.log('[OpenClaw] Received', data.contentBlocks.length, 'content blocks, incremental:', data.incremental, 
                    'types:', data.contentBlocks.map((b: any) => b.type))

                  // 使用后端发送的 incremental 标志来判断如何处理数据
                  if (data.incremental) {
                    // 增量数据：后端已经累积了所有块，直接替换
                    accumulatedContentBlocks = data.contentBlocks
                  } else {
                    // 非增量数据（chat delta）：包含完整的 content blocks，直接替换
                    accumulatedContentBlocks = data.contentBlocks
                  }

                  // 从 contentBlocks 中提取文本
                  const textParts = accumulatedContentBlocks
                    .filter((block: unknown) => {
                      const b = block as { type?: string; text?: string }
                      return b.type === 'text' && typeof b.text === 'string'
                    })
                    .map((block: unknown) => {
                      const b = block as { text?: string }
                      return b.text || ''
                    })
                    .join('')

                  accumulatedContent = textParts
                  console.log('[OpenClaw] Total blocks:', accumulatedContentBlocks.length, 'text length:', accumulatedContent.length)
                  onChunk('', accumulatedContent, accumulatedContentBlocks)
                } else {
                  // Legacy format: delta/content
                  const delta = data.delta || data.content || ''
                  accumulatedContent += delta
                  onChunk(delta, accumulatedContent)
                }
              } else if (data.type === 'finish') {
                // Stream finished
                onFinish()
                return
              } else if (data.type === 'error') {
                // Error occurred
                console.error('[OpenClaw] Stream error:', data.error)
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
}
