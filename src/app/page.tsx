"use client"

import { InputMachine } from "@/components/InputMachine"
import { MessagesList } from "@/components/MessagesList"
import { NewMessageButton } from "@/components/NewMessageButton"
import { WorkspaceBreadcrumb } from "@/components/WorkspaceBreadcrumb"
import { useState, useEffect, Suspense, useRef } from "react"
import { useSocket } from "@/hooks/useSocket"
import { useAppStore } from "@/store/useAppStore"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function HomeContent() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { setHasNewMessages } = useAppStore()
  const searchParams = useSearchParams()
  const scrollAttemptedRef = useRef(false)

  const handleMessageCreated = () => {
    // Trigger refresh of messages list
    setRefreshKey((prev) => prev + 1)

    // Dispatch custom event to trigger auto-refresh after 5 seconds (for AI tags)
    window.dispatchEvent(new CustomEvent('message-posted'))

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRefreshFromNotification = () => {
    setRefreshKey((prev) => prev + 1)
  }

  // 监听来自其他设备的新消息
  useSocket({
    onNewMessage: (data) => {
      setHasNewMessages(true)
    },
  })

  // Handle scrolling to specific message from URL parameter with retry mechanism
  const scrollToMessage = (retryCount = 0) => {
    const scrolltoId = searchParams.get('scrollto')
    if (!scrolltoId) return

    const element = document.getElementById(`message-${scrolltoId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      scrollAttemptedRef.current = true
    } else if (retryCount < 15) {
      // Retry with increasing delay (max ~1.2 seconds total)
      const delay = 80 * (retryCount + 1)
      setTimeout(() => scrollToMessage(retryCount + 1), delay)
    }
  }

  // Scroll when messages list refreshes
  useEffect(() => {
    const scrolltoId = searchParams.get('scrollto')
    if (scrolltoId) {
      // Reset flag and start scrolling attempts
      scrollAttemptedRef.current = false
      // Wait a bit for DOM to update after MessagesList re-renders
      setTimeout(() => scrollToMessage(), 150)
    }
  }, [refreshKey, searchParams])

  // Scroll when messages are loaded (this is called by MessagesList on refresh)
  const handleMessagesLoaded = () => {
    const scrolltoId = searchParams.get('scrollto')
    if (scrolltoId && !scrollAttemptedRef.current) {
      setTimeout(() => scrollToMessage(), 50)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-26.5 desktop:pt-0">
      {/* Desktop Workspace Breadcrumb */}
      <div className="desktop:block hidden sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="px-4 h-12 flex items-center justify-center">
          <WorkspaceBreadcrumb
            onWorkspaceChange={() => setRefreshKey((prev) => prev + 1)}
          />
        </div>
      </div>

      <InputMachine onSuccess={handleMessageCreated} />

      <MessagesList key={refreshKey} onMessagesLoaded={handleMessagesLoaded} />

      <NewMessageButton onRefresh={handleRefreshFromNotification} />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen pt-26.5 desktop:pt-0 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
