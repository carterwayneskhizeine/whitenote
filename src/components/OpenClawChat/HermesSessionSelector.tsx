"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2, ChevronDown } from 'lucide-react'
import { hermesApi, HermesSessionInfo } from './hermes-api'
import { cn } from '@/lib/utils'

interface HermesSessionSelectorProps {
  currentSessionId: string | null
  onSessionSelect: (sessionId: string, title?: string) => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function HermesSessionSelector({
  currentSessionId,
  onSessionSelect,
}: HermesSessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [sessions, setSessions] = useState<HermesSessionInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentTitle, setCurrentTitle] = useState<string>('New Chat')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) loadSessions()
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const result = await hermesApi.listSessions(50, 0)
      const sorted = result.sessions.sort((a, b) => b.last_active - a.last_active)
      setSessions(sorted)
      if (currentSessionId) {
        const match = sorted.find(s => s.id === currentSessionId)
        if (match?.title) setCurrentTitle(match.title)
      }
    } catch {
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  const currentLabel = (() => {
    if (!currentSessionId) return 'New Chat'
    const s = sessions.find(s => s.id === currentSessionId)
    if (s?.title && s.title !== 'Untitled') return s.title
    if (s?.preview) return s.preview.slice(0, 40)
    return currentTitle
  })()

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 h-8 px-2 text-sm"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="truncate max-w-[150px]">{currentLabel}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-background border rounded-lg shadow-lg z-50">
          <div className="p-2 border-b">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Recent Sessions</span>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="max-h-75 overflow-y-auto">
            <div className="p-1">
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer",
                  !currentSessionId ? "bg-muted" : "hover:bg-muted/50"
                )}
                onClick={() => {
                  onSessionSelect(null as unknown as string, 'New Chat')
                  setIsOpen(false)
                }}
              >
                <span className="text-sm">+ New Chat</span>
              </div>
            </div>

            {sessions.length === 0 && !isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No sessions yet.<br />Send a message to start!
              </div>
            )}

            <div className="p-1">
              {sessions.map(session => {
                const isCurrent = session.id === currentSessionId
                const title = (session.title && session.title !== 'Untitled')
                  ? session.title
                  : session.preview?.slice(0, 50) || 'Untitled'

                return (
                  <div
                    key={session.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer",
                      isCurrent ? "bg-muted" : "hover:bg-muted/50"
                    )}
                    onClick={() => {
                      setCurrentTitle(title)
                      onSessionSelect(session.id, title)
                      setIsOpen(false)
                    }}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm truncate">{title}</span>
                      <span className="text-xs text-muted-foreground">
                        {session.message_count} msgs · {session.source || 'local'} · {timeAgo(session.last_active)}
                      </span>
                    </div>
                    {session.is_active && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
