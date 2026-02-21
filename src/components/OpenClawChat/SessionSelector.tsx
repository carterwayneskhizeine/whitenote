"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare, Plus, Trash2, Edit2, X, Check, Loader2 } from 'lucide-react'
import { openclawApi } from './api'
import type { OpenClawSession } from './types'
import { cn } from '@/lib/utils'

interface SessionSelectorProps {
  currentSessionKey: string
  onSessionChange: (sessionKey: string, label?: string) => void
  onSessionCreated?: (sessionKey: string, label?: string) => void
  onSessionDeleted?: (sessionKey: string) => void
}

export function SessionSelector({
  currentSessionKey,
  onSessionChange,
  onSessionCreated,
  onSessionDeleted,
}: SessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [sessions, setSessions] = useState<OpenClawSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [newSessionLabel, setNewSessionLabel] = useState('')
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editedLabel, setEditedLabel] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load sessions when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setEditingLabel(null)
        setNewSessionLabel('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const result = await openclawApi.listSessions(50, 60 * 24) // Last 24 hours
      // Sort by updated time (most recent first)
      const sorted = result.sessions.sort((a, b) => b.updatedAt - a.updatedAt)
      setSessions(sorted)
    } catch (error) {
      console.error('[SessionSelector] Failed to load sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSession = async () => {
    if (!newSessionLabel.trim()) return

    setIsCreating(true)
    try {
      const result = await openclawApi.createSession(newSessionLabel.trim(), true)
      setNewSessionLabel('')
      setIsOpen(false)
      onSessionCreated?.(result.key, result.label)
      onSessionChange(result.key, result.label)
      // Reload sessions to include the new one
      await loadSessions()
    } catch (error) {
      console.error('[SessionSelector] Failed to create session:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteSession = async (sessionKey: string) => {
    setIsDeleting(sessionKey)
    try {
      await openclawApi.deleteSession(sessionKey, false) // Don't delete transcript
      setSessions(prev => prev.filter(s => s.key !== sessionKey))
      onSessionDeleted?.(sessionKey)
      // If deleted session was current, switch to main
      if (sessionKey === currentSessionKey) {
        onSessionChange('main')
      }
    } catch (error) {
      console.error('[SessionSelector] Failed to delete session:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleUpdateLabel = async (sessionKey: string) => {
    if (!editedLabel.trim()) {
      setEditingLabel(null)
      return
    }

    try {
      await openclawApi.updateSession(sessionKey, editedLabel.trim())
      setSessions(prev =>
        prev.map(s =>
          s.key === sessionKey ? { ...s, label: editedLabel.trim() } : s
        )
      )
      setEditingLabel(null)
      // If updated session is current, notify parent
      if (sessionKey === currentSessionKey) {
        onSessionChange(sessionKey, editedLabel.trim())
      }
    } catch (error) {
      console.error('[SessionSelector] Failed to update label:', error)
    }
  }

  const getCurrentLabel = () => {
    const current = sessions.find(s => s.key === currentSessionKey)
    if (current?.label) return current.label
    if (currentSessionKey === 'main' || currentSessionKey === 'agent:main:main') return 'Main Chat'
    return currentSessionKey
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 h-8 px-2 text-sm"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="truncate max-w-[150px]">{getCurrentLabel()}</span>
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-background border rounded-lg shadow-lg z-50">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New chat name..."
                value={newSessionLabel}
                onChange={e => setNewSessionLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateSession()
                  }
                }}
                className="flex-1 h-8 px-2 text-sm bg-muted/30 rounded border border-transparent focus:border-primary/20 focus:bg-muted/50 focus:outline-none"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleCreateSession}
                disabled={!newSessionLabel.trim() || isCreating}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No sessions yet.<br />Create one above!
              </div>
            ) : (
              <div className="p-1">
                {sessions.map(session => {
                  const isCurrent = session.key === currentSessionKey
                  const isDeletingThis = isDeleting === session.key
                  const isEditingThis = editingLabel === session.key
                  const displayLabel = session.label ||
                    (session.key === 'main' || session.key === 'agent:main:main' ? 'Main Chat' : session.key)

                  return (
                    <div
                      key={session.key}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1.5 rounded-md group",
                        isCurrent && "bg-muted",
                        !isCurrent && "hover:bg-muted/50"
                      )}
                    >
                      {isEditingThis ? (
                        <>
                          <input
                            type="text"
                            defaultValue={displayLabel}
                            onChange={e => setEditedLabel(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleUpdateLabel(session.key)
                              } else if (e.key === 'Escape') {
                                setEditingLabel(null)
                              }
                            }}
                            autoFocus
                            className="flex-1 h-7 px-2 text-sm bg-background rounded border border-primary/20 focus:outline-none"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleUpdateLabel(session.key)}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setEditingLabel(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              onSessionChange(session.key, session.label)
                              setIsOpen(false)
                            }}
                            className="flex-1 text-left text-sm truncate px-2 py-1"
                          >
                            {displayLabel}
                          </button>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0"
                              onClick={() => {
                                setEditingLabel(session.key)
                                setEditedLabel(displayLabel)
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            {/* Don't allow deleting main session */}
                            {session.key !== 'main' && session.key !== 'agent:main:main' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSession(session.key)}
                                disabled={isDeletingThis}
                              >
                                {isDeletingThis ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
