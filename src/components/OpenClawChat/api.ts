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
    const response = await fetch(`${API_BASE}/chat/history?sessionKey=${sessionKey}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get history')
    }

    const data = await response.json()
    const allMessages = (data.messages || []) as unknown[]

    if (allMessages.length === 0) {
      return null
    }

    // Find the last user message timestamp
    let userTimestamp: number | undefined
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i] as { role?: string; timestamp?: number }
      if (msg.role === 'user' && msg.timestamp) {
        userTimestamp = msg.timestamp
        break
      }
    }

    if (!userTimestamp) {
      // No user message found, return the last message if it's an assistant message
      const lastMsg = allMessages[allMessages.length - 1] as { role?: string }
      if (lastMsg.role === 'assistant') {
        return this.pollMessage(sessionKey, undefined)
      }
      return null
    }

    // Use pollMessage to get the merged response
    return this.pollMessage(sessionKey, userTimestamp)
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
      relevantMessages.map((m: any) => ({ role: m.role, timestamp: m.timestamp, contentType: Array.isArray(m.content) ? 'array' : typeof m.content })))

    if (relevantMessages.length === 0) {
      return null
    }

    // Sort messages by timestamp to maintain chronological order
    relevantMessages.sort((a: unknown, b: unknown) => {
      const tsA = (a as { timestamp?: number }).timestamp || 0
      const tsB = (b as { timestamp?: number }).timestamp || 0
      return tsA - tsB
    })

    // Build content blocks in chronological order (not grouped by type)
    // This mimics what you see when you refresh the page:
    // - Thinking block 1 -> Tool Call -> Tool Result -> Thinking block 2 -> Text
    const mergedContentBlocks: { type: 'thinking' | 'toolCall' | 'text' | 'toolResult'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[] = []
    const mergedTextParts: string[] = []
    const mergedThinkingBlocks: { type: 'thinking'; thinking: string; thinkingSignature?: string }[] = []

    // Track tool calls to match with results
    interface ToolCallInfo {
      id: string
      name: string
      arguments: Record<string, unknown>
      timestamp: number
    }
    const pendingToolCalls: ToolCallInfo[] = []

    for (const msg of relevantMessages) {
      const m = msg as { role?: string; content?: unknown; timestamp?: number; name?: string; toolCallId?: string }

      // Skip user messages in the merge
      if (m.role === 'user') continue

      const rawContent = m.content
      const msgTimestamp = m.timestamp || 0

      // Handle toolResult messages
      if (m.role === 'toolResult') {
        let toolResultText = ''
        let toolResultId = m.toolCallId

        if (typeof rawContent === 'string') {
          toolResultText = rawContent
        } else if (Array.isArray(rawContent)) {
          for (const item of rawContent) {
            if (!item || typeof item !== 'object') continue
            const obj = item as { type?: string; text?: string; id?: string }
            if (obj.type === 'toolResult' && obj.text) {
              toolResultText = obj.text
              toolResultId = obj.id || toolResultId
            } else if (obj.text) {
              toolResultText = obj.text
            }
          }
        }

        if (toolResultText) {
          // Find matching tool call
          const matchedCall = pendingToolCalls.find(tc => tc.id === toolResultId)

          mergedContentBlocks.push({
            type: 'toolResult' as const,
            id: toolResultId,
            name: m.name || matchedCall?.name,
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
            const toolCallInfo: ToolCallInfo = {
              id: obj.id || '',
              name: obj.name || '',
              arguments: obj.arguments || {},
              timestamp: msgTimestamp,
            }
            pendingToolCalls.push(toolCallInfo)

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
        mergedContentBlocks.push({
          type: 'text',
          text: rawContent,
        })
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
