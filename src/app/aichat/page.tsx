"use client"

import { useState, useEffect, useRef } from "react"
import { ChatWindow, BackendType } from "@/components/OpenClawChat/ChatWindow"
import { SessionSelector } from "@/components/OpenClawChat/SessionSelector"
import { HermesSessionSelector } from "@/components/OpenClawChat/HermesSessionSelector"
import { cn } from "@/lib/utils"
import { Bot, Wrench } from "lucide-react"

const BACKEND_STORAGE_KEY = 'aichat-backend'

function loadBackendFromStorage(): BackendType {
  if (typeof window === 'undefined') return 'openclaw'
  try {
    const stored = localStorage.getItem(BACKEND_STORAGE_KEY)
    if (stored === 'hermes' || stored === 'openclaw') return stored
  } catch {}
  return 'openclaw'
}

function saveBackendToStorage(backend: BackendType) {
  try {
    localStorage.setItem(BACKEND_STORAGE_KEY, backend)
  } catch {}
}

export default function AIChatPage() {
  const [viewportHeight, setViewportHeight] = useState(0)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [currentSessionKey, setCurrentSessionKey] = useState('main')
  const [currentSessionLabel, setCurrentSessionLabel] = useState<string | undefined>('Main Chat')
  const [backend, setBackend] = useState<BackendType>(loadBackendFromStorage)
  const [hermesSessionId, setHermesSessionId] = useState<string | null>(null)
  const maxHeightRef = useRef(0)
  const lastWidthRef = useRef(0)

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const height = window.visualViewport.height
        const width = window.visualViewport.width
        setViewportHeight(height)
        if (width !== lastWidthRef.current) {
          maxHeightRef.current = height
          lastWidthRef.current = width
        }
        if (height > maxHeightRef.current) {
          maxHeightRef.current = height
        }
        setIsKeyboardOpen(maxHeightRef.current - height > 150)
      }
    }
    handleResize()
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  const handleSessionChange = (sessionKey: string, label?: string) => {
    setCurrentSessionKey(sessionKey)
    setCurrentSessionLabel(label)
  }

  const handleBackendChange = (newBackend: BackendType) => {
    setBackend(newBackend)
    saveBackendToStorage(newBackend)
    setCurrentSessionKey(newBackend === 'hermes' ? 'hermes-default' : 'main')
    setCurrentSessionLabel(newBackend === 'hermes' ? 'Hermes Chat' : 'Main Chat')
    if (newBackend === 'hermes') {
      setHermesSessionId(null)
    }
  }

  const handleHermesSessionSelect = (sessionId: string | null, title?: string) => {
    setHermesSessionId(sessionId)
    setCurrentSessionKey(sessionId || 'hermes-default')
    setCurrentSessionLabel(title || (sessionId ? 'Hermes Chat' : 'New Chat'))
  }

  return (
    <div
      className={cn(
        "flex flex-col desktop:h-dvh fixed desktop:sticky top-0 left-0 right-0 desktop:z-0 bg-background overflow-hidden",
        isKeyboardOpen ? "z-[45]" : "z-[35]"
      )}
      style={{
        ...(typeof window !== 'undefined' && window.innerWidth < 750 ? {
          width: '100vw',
          maxWidth: '100vw',
          left: 0,
          right: 0,
          height: viewportHeight ? `${viewportHeight}px` : '100vh',
          overflow: 'hidden',
          overflowX: 'hidden',
          overscrollBehavior: 'none'
        } : {})
      }}
    >
      <div className="shrink-0 sticky top-0 border-b px-4 py-3 bg-background z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">AI Chat</h1>
            <div className="flex bg-muted/50 rounded-lg p-0.5">
              <button
                onClick={() => handleBackendChange('openclaw')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  backend === 'openclaw'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Bot className="w-3.5 h-3.5" />
                OpenClaw
              </button>
              <button
                onClick={() => handleBackendChange('hermes')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  backend === 'hermes'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Wrench className="w-3.5 h-3.5" />
                Hermes
              </button>
            </div>
          </div>
          {backend === 'openclaw' ? (
            <SessionSelector
              currentSessionKey={currentSessionKey}
              onSessionChange={handleSessionChange}
              onSessionCreated={(key, label) => {
                setCurrentSessionKey(key)
                setCurrentSessionLabel(label)
              }}
              onSessionDeleted={(key) => {
                if (key === currentSessionKey) {
                  setCurrentSessionKey('main')
                  setCurrentSessionLabel('Main Chat')
                }
              }}
            />
          ) : (
            <HermesSessionSelector
              currentSessionId={hermesSessionId}
              onSessionSelect={handleHermesSessionSelect}
            />
          )}
        </div>
      </div>
      <ChatWindow
        isKeyboardOpen={isKeyboardOpen}
        currentSessionKey={currentSessionKey}
        onSessionChange={handleSessionChange}
        backend={backend}
        hermesSessionId={hermesSessionId}
        onHermesSessionUpdate={setHermesSessionId}
      />
    </div>
  )
}
