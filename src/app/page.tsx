"use client"

import { InputMachine } from "@/components/InputMachine"
import { MessagesList } from "@/components/MessagesList"
import { NewMessageButton } from "@/components/NewMessageButton"
import { useState, useEffect, Suspense, useRef } from "react"
import { useSocket } from "@/hooks/useSocket"
import { useAppStore } from "@/store/useAppStore"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { workspacesApi } from "@/lib/api/workspaces"
import type { Workspace } from "@/types/api"
import { ChevronDown, Loader2 } from "lucide-react"

function HomeContent() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { setHasNewMessages } = useAppStore()
  const { data: session } = useSession()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore()
  const searchParams = useSearchParams()
  const scrollAttemptedRef = useRef(false)

  // 获取当前选中的 Workspace
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)

  // 加载用户的 Workspace 列表
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (session?.user) {
        try {
          const result = await workspacesApi.getWorkspaces()
          if (result.data) {
            setWorkspaces(result.data)
            // 如果没有选中的 Workspace 且有默认 Workspace，自动选中
            if (!currentWorkspaceId && result.data.length > 0) {
              const defaultWorkspace = result.data.find((w) => w.isDefault) || result.data[0]
              setCurrentWorkspaceId(defaultWorkspace.id)
            }
          }
        } catch (error) {
          console.error("Failed to fetch workspaces:", error)
        } finally {
          setIsLoading(false)
        }
      }
    }
    fetchWorkspaces()
  }, [session, currentWorkspaceId])

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
    <div className="flex flex-col min-h-screen pt-[106px] desktop:pt-0">
      <div className="desktop:block hidden sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex w-full relative">
          {/* Workspace 下拉菜单触发器 */}
          <button
            className="flex-1 py-4 hover:bg-secondary/50 transition-colors relative flex justify-center items-center gap-2"
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="font-bold text-sm">
                  {currentWorkspace?.name || '选择工作区'}
                </span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
            <div className="absolute bottom-0 h-1 w-14 bg-primary rounded-full" />
          </button>

          {/* Workspace 下拉菜单 */}
          {showWorkspaceMenu && (
            <div className="absolute top-full left-0 w-full bg-background border border-border rounded-b-lg shadow-lg z-50">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  className={`w-full px-4 py-3 text-center hover:bg-secondary/50 transition-colors ${
                    currentWorkspaceId === ws.id ? 'bg-secondary/30' : ''
                  }`}
                  onClick={() => {
                    setCurrentWorkspaceId(ws.id)
                    setShowWorkspaceMenu(false)
                    setRefreshKey((prev) => prev + 1) // 刷新消息列表
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-medium">{ws.name}</span>
                    {ws.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">默认</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
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
      <div className="flex flex-col min-h-screen pt-[106px] desktop:pt-0 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
