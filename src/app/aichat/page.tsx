"use client"

import { useState, useEffect, useRef } from "react"
import { ChatWindow } from "@/components/OpenClawChat/ChatWindow"
import { SessionSelector } from "@/components/OpenClawChat/SessionSelector"
import { cn } from "@/lib/utils"

export default function AIChatPage() {
  const [viewportHeight, setViewportHeight] = useState(0)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [currentSessionKey, setCurrentSessionKey] = useState('main')
  const [currentSessionLabel, setCurrentSessionLabel] = useState<string | undefined>('Main Chat')
  const maxHeightRef = useRef(0)
  const lastWidthRef = useRef(0)

  // Handle Visual Viewport API for keyboard
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const height = window.visualViewport.height
        const width = window.visualViewport.width

        setViewportHeight(height)

        // If width changed, we likely rotated - reset max height
        if (width !== lastWidthRef.current) {
          maxHeightRef.current = height
          lastWidthRef.current = width
        }

        // Update maximum height seen so far (likely keyboard closed state)
        if (height > maxHeightRef.current) {
          maxHeightRef.current = height
        }

        // Detect if keyboard is likely open (height significantly less than max height)
        setIsKeyboardOpen(maxHeightRef.current - height > 150)
      }
    }

    // Initial set
    handleResize()

    // Listen to viewport changes
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
          <h1 className="text-xl font-bold">AI Chat</h1>
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
        </div>
      </div>
      <ChatWindow
        isKeyboardOpen={isKeyboardOpen}
        currentSessionKey={currentSessionKey}
        onSessionChange={handleSessionChange}
      />
    </div>
  )
}
