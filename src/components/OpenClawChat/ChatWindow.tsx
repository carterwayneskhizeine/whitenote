"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, AlertCircle, Loader2, Maximize2, X } from 'lucide-react'
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const userMessageTimestampRef = useRef<number | null>(null)
  const isLoadingRef = useRef(false)
  const pendingAssistantIdRef = useRef<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current
    if (!textarea) return
    
    textarea.style.height = 'auto'
    const lineHeight = 22
    const maxHeight = lineHeight * 3 + 16
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [input, adjustTextareaHeight])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await openclawApi.getHistory(DEFAULT_SESSION_KEY)
        if (history.length > 0) {
          const messagesWithIds = history.map((msg, idx) => ({
            ...msg,
            id: msg.timestamp ? `${msg.timestamp}-${idx}` : `msg-${idx}`,
            content: msg.content,
            timestamp: msg.timestamp ?? Date.now(),
            thinkingBlocks: msg.thinkingBlocks,
            contentBlocks: msg.contentBlocks,
          })) as ChatMessage[]
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

    const userTimestamp = Date.now()
    const userMessage: ChatMessage = {
      id: userTimestamp.toString(),
      role: 'user',
      content: input.trim(),
      timestamp: userTimestamp,
    }

    const pendingAssistantId = `pending-${userTimestamp}`
    const pendingAssistantMessage: ChatMessage = {
      id: pendingAssistantId,
      role: 'assistant',
      content: '',
      timestamp: userTimestamp + 1,
    }

    setMessages(prev => [...prev, userMessage, pendingAssistantMessage])
    setInput('')
    setIsLoading(true)
    isLoadingRef.current = true
    setError(null)
    userMessageTimestampRef.current = userTimestamp
    pendingAssistantIdRef.current = pendingAssistantId

    try {
      const content = typeof userMessage.content === 'string' ? userMessage.content : JSON.stringify(userMessage.content)

      await openclawApi.sendMessageStream(
        DEFAULT_SESSION_KEY,
        content,
        (delta, fullContent) => {
          if (!isLoadingRef.current) return

          const pendingId = pendingAssistantIdRef.current
          if (!pendingId) return

          setMessages(prev =>
            prev.map(msg => {
              if (msg.id === pendingId && msg.role === 'assistant') {
                return {
                  ...msg,
                  content: fullContent,
                } as ChatMessage
              }
              return msg
            })
          )
        },
        async () => {
          isLoadingRef.current = false
          setIsLoading(false)
          pendingAssistantIdRef.current = null

          // 流结束后，获取完整的消息（包含 thinking/toolCall）
          try {
            const assistantMsgs = await openclawApi.getAssistantMessages(DEFAULT_SESSION_KEY, userTimestamp)
            if (assistantMsgs.length > 0) {
              setMessages(prev => {
                const userIdx = prev.findIndex(m => m.timestamp === userTimestamp)
                if (userIdx < 0) return prev
                const beforePending = prev.slice(0, userIdx + 1).filter(m => !m.id.startsWith('pending-'))
                const newMessages: ChatMessage[] = assistantMsgs.map((msg, idx) => ({
                  ...msg,
                  id: msg.timestamp ? `${msg.timestamp}-${idx}` : `assistant-${idx}`,
                  timestamp: msg.timestamp ?? Date.now(),
                }))
                return [...beforePending, ...newMessages]
              })
            }
          } catch (err) {
            console.error('[OpenClawChat] Final fetch error:', err)
          }
        },
        (error) => {
          setError(error)
          isLoadingRef.current = false
          pendingAssistantIdRef.current = null
          setMessages(prev => prev.filter(m => !m.id.startsWith('pending-')))
          setIsLoading(false)
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      isLoadingRef.current = false
      pendingAssistantIdRef.current = null
      setMessages(prev => prev.filter(m => !m.id.startsWith('pending-')))
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isFullscreen) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (!isFullscreen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const closeFullscreen = () => {
    setIsFullscreen(false)
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">New Message</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeFullscreen}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="What's happening?"
            className="flex-1 w-full resize-none bg-transparent px-4 py-3 text-base placeholder:text-muted-foreground/60 focus:outline-none"
            disabled={isLoading}
            autoFocus
          />
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-xs text-muted-foreground">
              {input.length > 0 && <span>{input.length} characters</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-full px-5"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {error && (
        <div className="flex items-center gap-2 p-3 mb-2 text-sm text-red-500 bg-red-50 rounded-md mx-4">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <ScrollArea className="flex-1 w-full min-h-0">
        <div className="space-y-4 w-full px-2 min-w-0 pb-4">
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
              className="flex justify-start w-full min-w-0"
            >
              <div
                className="rounded-lg px-2 py-2 w-full min-w-0 break-words bg-transparent"
                style={{ maxWidth: 'calc(100vw - 16px)' }}
              >
                {message.role === 'user' && (
                  <div className="text-sm font-semibold text-muted-foreground mb-1">You</div>
                )}
                <AIMessageViewer
                  key={`${message.id}-${JSON.stringify(message.content).slice(0, 20)}`}
                  message={message}
                  thinkingBlocks={(message as any).thinkingBlocks}
                  contentBlocks={(message as any).contentBlocks}
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
          "p-3 pb-safe-or-3 border-t w-full shrink-0 bg-background",
          !isKeyboardOpen && "mb-[53px] desktop:mb-0"
        )}
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 relative flex items-end bg-muted/30 rounded-2xl border border-transparent focus-within:border-primary/20 focus-within:bg-muted/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              className="flex-1 w-full min-h-[40px] max-h-[82px] resize-none bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
              disabled={isLoading}
              rows={1}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="shrink-0 rounded-full w-8 h-8 mr-1 mb-1 text-muted-foreground hover:text-foreground"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            type="submit" 
            size="icon"
            disabled={isLoading || !input.trim()}
            className="rounded-full w-10 h-10 shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
