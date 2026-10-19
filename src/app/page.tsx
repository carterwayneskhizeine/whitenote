"use client"

import { InputMachine } from "@/components/InputMachine"
import { MessagesList, type MessagesListHandle } from "@/components/MessagesList"
import { NewMessageButton } from "@/components/NewMessageButton"
import { WorkspaceBreadcrumb } from "@/components/WorkspaceBreadcrumb"
import { useState, useEffect, Suspense, useRef, useCallback } from "react"
import { useSocket } from "@/hooks/useSocket"
import { useAppStore } from "@/store/useAppStore"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import { resolveNewMessageJump } from "@/lib/new-message-target"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

// 滚动到指定消息，元素尚未渲染时重试（与 scrollto 深链逻辑一致）。
// 重试用尽仍找不到元素（合并尚未提交进 DOM）时兜底跳详情页，
// 免得又变成「点了没反应」。
function scrollToMessageElement(messageId: string, retryCount = 0) {
  const element = document.getElementById(`message-${messageId}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return true
  }
  if (retryCount < 15) {
    const delay = 80 * (retryCount + 1)
    setTimeout(() => scrollToMessageElement(messageId, retryCount + 1), delay)
  } else {
    window.location.href = `/status/${messageId}`
  }
  return false
}

function HomeContent() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { pushNewMessage, acknowledgeNewMessages, newMessageIds } = useAppStore()
  const { setCurrentWorkspaceId } = useWorkspaceStore()
  const searchParams = useSearchParams()
  const router = useRouter()
  const scrollAttemptedRef = useRef(false)
  const messagesListRef = useRef<MessagesListHandle>(null)

  // 从搜索结果返回时，若携带 workspace 参数则切换 workspace
  useEffect(() => {
    const workspaceParam = searchParams.get('workspace')
    if (workspaceParam) {
      setCurrentWorkspaceId(workspaceParam)
    }
  }, [searchParams, setCurrentWorkspaceId])

  const handleMessageCreated = () => {
    // Trigger refresh of messages list
    setRefreshKey((prev) => prev + 1)

    // Dispatch custom event to trigger auto-refresh after 5 seconds (for AI tags)
    window.dispatchEvent(new CustomEvent('message-posted'))

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 点击「有新消息」：静默拉取最新消息合并进列表，然后定位到那条新消息。
  // 不再整体刷新列表，因此不会丢失用户已加载的分页和滚动位置。
  //
  // socket 的推送是按 user 房间广播的、不分 workspace，而信息流是按当前
  // workspace 分页的。所以新消息常常不在当前信息流的第一页里 —— 这种情况
  // 下必须跳详情页，滚是滚不到的（否则就退化成「点了没反应」）。
  const handleShowNewMessages = useCallback(async () => {
    // 必须在 acknowledge 之前取：它会把 newMessageIds 清空
    const pendingIds = newMessageIds
    acknowledgeNewMessages()

    const snapshot = await messagesListRef.current?.fetchLatestAndMerge()

    const target = resolveNewMessageJump({
      pendingIds,
      latestPageIds: snapshot?.latestPageIds ?? [],
      renderedIds: new Set(snapshot?.renderedIds ?? []),
    })

    if (target.kind === 'scroll') {
      scrollToMessageElement(target.messageId)
      return
    }

    if (target.kind === 'navigate') {
      router.push(`/status/${target.messageId}`)
      return
    }

    // 没有可跳转的新消息（例如网络失败），退回到信息流顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [acknowledgeNewMessages, newMessageIds, router])

  // 监听来自其他设备的新消息
  useSocket({
    onNewMessage: (data) => {
      pushNewMessage(data.messageId)
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
      <InputMachine onSuccess={handleMessageCreated} />
      {/* 必须在 MessagesList 之前渲染，sticky 才能在信息流滚动时悬浮在顶部 */}
      <NewMessageButton onClick={handleShowNewMessages} />
      <MessagesList
        ref={messagesListRef}
        key={refreshKey}
        onMessagesLoaded={handleMessagesLoaded}
      />
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
