"use client"

import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, AlertCircle, Loader2 } from 'lucide-react'
import { openclawApi, ChatStreamEvent } from './api'
import { TipTapViewer } from '@/components/TipTapViewer'
import type { ChatMessage } from './types'

const DEFAULT_SESSION_KEY = 'main'

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await openclawApi.getHistory(DEFAULT_SESSION_KEY, 50)
        const formattedMessages: ChatMessage[] = history.map((msg, idx) => ({
          id: `history-${idx}-${Date.now()}`,
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: msg.timestamp || Date.now(),
        }))
        setMessages(formattedMessages)
      } catch (err) {
        console.error('[OpenClaw Chat] Failed to load history:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const generator = openclawApi.sendMessageStream(
        DEFAULT_SESSION_KEY,
        userMessage.content
      )

      for await (const event of generator) {
        console.log('[OpenClaw Chat] Received event:', event)
        if (event.type === 'content' && event.delta) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + event.delta }
                : msg
            )
          )
        } else if (event.type === 'finish') {
          console.log('[OpenClaw Chat] Finished:', event)
        } else if (event.type === 'error') {
          console.log('[OpenClaw Chat] Error:', event)
          setError(event.message || 'An error occurred')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
    } finally {
      setIsLoading(false)
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
                    : 'bg-muted'
                }`}
              >
                <TipTapViewer 
                  content={message.content} 
                  className={message.role === 'user' ? 'text-primary-foreground' : ''}
                />
                {message.role === 'assistant' && isLoading && message.content === '' && (
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

      <form onSubmit={handleSubmit} className="p-4 pb-safe-or-4 border-t w-full shrink-0 bg-background mb-[53px] desktop:mb-0">
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
