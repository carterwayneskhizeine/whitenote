"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, AlertCircle, Loader2 } from 'lucide-react'
import { openclawApi } from './api'
import { AIMessageViewer } from './AIMessageViewer'
import type { ChatMessage } from './types'
import { cn } from '@/lib/utils'

const DEFAULT_SESSION_KEY = 'main'

const STORAGE_KEY = 'openclaw-chat-messages'

function loadFromStorage(): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('[OpenClaw Chat] Failed to load from storage:', e)
  }
  return []
}

function saveToStorage(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch (e) {
    console.error('[OpenClaw Chat] Failed to save to storage:', e)
  }
}

export function ChatWindow({ isKeyboardOpen }: { isKeyboardOpen?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // 使用 ref 跟踪当前活跃的 assistant 消息 ID 和加载状态，避免闭包问题
  const currentAssistantIdRef = useRef<string | null>(null)
  const isLoadingRef = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [])

  // 清除所有轮询的辅助函数
  const clearAllPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await openclawApi.getHistory(DEFAULT_SESSION_KEY)
        if (history.length > 0) {
          const messagesWithIds: ChatMessage[] = history.map((msg, idx) => ({
            ...msg,
            id: msg.timestamp ? `${msg.timestamp}-${idx}` : `msg-${idx}`,
            content: msg.content,
            timestamp: msg.timestamp ?? Date.now(),
            thinkingBlocks: msg.thinkingBlocks,
            contentBlocks: msg.contentBlocks,
          }))
          setMessages(messagesWithIds)
        }
      } catch (err) {
        console.error('[OpenClawChat] Failed to load history:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [])

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      saveToStorage(messages)
    }
  }, [messages, isLoadingHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    // 先清除之前的轮询
    clearAllPolling()

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    isLoadingRef.current = true
    setError(null)

    const assistantMessageId = (Date.now() + 1).toString()
    // 保存当前 assistant 消息 ID 到 ref，供轮询使用
    currentAssistantIdRef.current = assistantMessageId

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const content = typeof userMessage.content === 'string' ? userMessage.content : JSON.stringify(userMessage.content)

      await openclawApi.sendMessageStream(
        DEFAULT_SESSION_KEY,
        content,
        // onChunk: Update message with new content and content blocks
        (_delta, fullContent, contentBlocks) => {
          // 检查是否仍在加载当前消息
          if (!isLoadingRef.current || currentAssistantIdRef.current !== assistantMessageId) {
            return
          }

          // Convert contentBlocks to thinkingBlocks and display format
          const thinkingBlocks: { type: 'thinking'; thinking: string; thinkingSignature?: string }[] = []
          const displayContentBlocks: { type: 'thinking' | 'toolCall' | 'text' | 'toolResult'; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }[] = []

          if (contentBlocks && Array.isArray(contentBlocks)) {
            for (const block of contentBlocks) {
              const b = block as { type?: string; thinking?: string; thinkingSignature?: string; name?: string; arguments?: Record<string, unknown>; text?: string; id?: string }

              if (b.type === 'thinking' && b.thinking) {
                thinkingBlocks.push({
                  type: 'thinking',
                  thinking: b.thinking,
                  thinkingSignature: b.thinkingSignature,
                })
                displayContentBlocks.push({
                  type: 'thinking',
                  thinking: b.thinking,
                  thinkingSignature: b.thinkingSignature,
                })
              } else if (b.type === 'toolCall') {
                displayContentBlocks.push({
                  type: 'toolCall',
                  id: b.id,
                  name: b.name,
                  arguments: b.arguments,
                })
              } else if (b.type === 'text' && b.text) {
                displayContentBlocks.push({
                  type: 'text',
                  text: b.text,
                })
              }
            }
          }

          setMessages(prev =>
            prev.map(msg => {
              if (msg.id === assistantMessageId && msg.role === 'assistant') {
                return {
                  ...msg,
                  content: fullContent,
                  thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : undefined,
                  contentBlocks: displayContentBlocks.length > 0 ? displayContentBlocks : undefined,
                } as ChatMessage
              }
              return msg
            })
          )
        },
        // onFinish: Loading complete
        async () => {
          // 先更新 ref 状态，防止轮询继续
          isLoadingRef.current = false
          setIsLoading(false)
          // Clear all polling
          clearAllPolling()

          // Reload to get complete message data including thinking blocks and tool calls
          try {
            const completeMsg = await openclawApi.getLastCompleteResponse(DEFAULT_SESSION_KEY)
            // 确保仍在处理同一条消息
            if (completeMsg && completeMsg.role === 'assistant' && currentAssistantIdRef.current === assistantMessageId) {
              setMessages(prev =>
                prev.map(msg => {
                  if (msg.id === assistantMessageId && msg.role === 'assistant') {
                    return {
                      ...msg,
                      content: completeMsg.content,
                      thinkingBlocks: completeMsg.thinkingBlocks,
                      contentBlocks: completeMsg.contentBlocks,
                    } as ChatMessage
                  }
                  return msg
                })
              )
            }
          } catch (err) {
            console.error('[OpenClawChat] Failed to reload complete message:', err)
          }
        },
        // onError: Handle errors
        (error) => {
          setError(error)
          isLoadingRef.current = false
          // 只移除 assistant 消息，保留用户消息
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
          setIsLoading(false)
          // Clear all polling
          clearAllPolling()
        }
      )

      // Start polling after 3 seconds to get progress updates (thinking, tool calls, etc.)
      // 使用 ref 检查状态，避免闭包问题
      pollingTimeoutRef.current = setTimeout(() => {
        if (!isLoadingRef.current) {
          console.log('[OpenClawChat] Loading already finished, skip polling')
          return
        }
        console.log('[OpenClawChat] Starting progress polling...')
        pollingRef.current = setInterval(async () => {
          // 使用 ref 检查是否仍在加载
          if (!isLoadingRef.current) {
            clearAllPolling()
            return
          }
          // 获取当前 assistant 消息 ID
          const currentId = currentAssistantIdRef.current
          if (!currentId) return

          try {
            const progressMsg = await openclawApi.getLastCompleteResponse(DEFAULT_SESSION_KEY)
            // 确保仍在处理同一条消息
            if (progressMsg && progressMsg.role === 'assistant' && currentAssistantIdRef.current === currentId && isLoadingRef.current) {
              console.log('[OpenClawChat] Polling update:', progressMsg.contentBlocks?.map(b => ({ type: b.type, name: b.name })))
              setMessages(prev =>
                prev.map(msg => {
                  if (msg.id === currentId && msg.role === 'assistant') {
                    return {
                      ...msg,
                      content: progressMsg.content,
                      thinkingBlocks: progressMsg.thinkingBlocks,
                      contentBlocks: progressMsg.contentBlocks,
                    } as ChatMessage
                  }
                  return msg
                })
              )
            }
          } catch (err) {
            console.error('[OpenClawChat] Polling error:', err)
          }
        }, 3000)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      isLoadingRef.current = false
      // 只移除 assistant 消息，保留用户消息
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
      setIsLoading(false)
      clearAllPolling()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="flex items-center gap-2 p-3 mb-2 text-sm text-red-500 bg-red-50 rounded-md mx-4">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <ScrollArea className="flex-1 w-full min-h-0">
        <div className="space-y-4 w-full px-4 min-w-0 pb-4">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 mb-4 animate-spin" />
              <p className="text-sm">Loading chat history...</p>
            </div>
          ) : messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bot className="w-12 h-12 mb-4" />
              <h3 className="text-lg font-semibold">Start a conversation</h3>
              <p className="text-sm">Send a message to begin chatting with OpenClaw</p>
            </div>
          )}

           {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full min-w-0`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[85%] md:max-w-[90%] min-w-0 break-words ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : message.role === 'toolResult'
                    ? 'bg-transparent'
                    : 'bg-muted'
                }`}
              >
                <AIMessageViewer
                  key={`${message.id}-${JSON.stringify(message.content).slice(0, 20)}`}
                  message={message}
                  thinkingBlocks={(message as any).thinkingBlocks}
                  contentBlocks={(message as any).contentBlocks}
                  className={message.role === 'user' ? 'text-primary-foreground' : ''}
                />
                {message.role === 'assistant' && isLoading &&
                  ((typeof message.content === 'string' && message.content === '') ||
                   (Array.isArray(message.content) && message.content.length === 0)) && (
                  <span className="inline-flex gap-1 ml-1">
                    <span className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form 
        onSubmit={handleSubmit} 
        className={cn(
          "p-4 pb-safe-or-4 border-t w-full shrink-0 bg-background",
          !isKeyboardOpen && "mb-[53px] desktop:mb-0"
        )}
      >
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 min-h-[44px] max-h-[200px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            rows={1}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
