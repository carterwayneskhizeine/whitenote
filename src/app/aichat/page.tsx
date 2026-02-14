"use client"

import { useState, useEffect } from "react"
import { ChatWindow } from "@/components/OpenClawChat/ChatWindow"

export default function AIChatPage() {
  const [viewportHeight, setViewportHeight] = useState(0)

  // Handle Visual Viewport API for keyboard
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
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

  return (
    <div
      className="flex flex-col"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100vh', overflow: 'hidden' }}
    >
      <div className="shrink-0 border-b px-4 py-3 bg-background desktop:bg-transparent z-50 desktop:z-0 relative">
        <h1 className="text-xl font-bold">AI Chat</h1>
      </div>
      <ChatWindow />
    </div>
  )
}
