"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Message, messagesApi } from "@/lib/api/messages"
import { TipTapEditor } from "@/components/TipTapEditor"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function EditMessagePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [message, setMessage] = useState<Message | null>(null)
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const result = await messagesApi.getMessage(id)
        if (result.data) {
          setMessage(result.data)
          setContent(result.data.content)
        } else if (result.error) {
          setError(result.error)
        }
      } catch (err) {
        console.error("Failed to fetch message:", err)
        setError("Failed to load message")
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchMessage()
    }
  }, [id])

  const handleSave = async () => {
    if (isSaving || !message) return

    setIsSaving(true)
    try {
      // 只更新内容，保留现有标签（不发送 tags 字段）
      const result = await messagesApi.updateMessage(message.id, {
        content,
      })

      if (result.data) {
        // Replace the current edit page in history with the message detail page
        // This ensures that clicking back from the detail page goes to the previous page (home)
        router.replace(`/status/${message.id}`)
      }
    } catch (error) {
      console.error("Failed to save message:", error)
      alert("保存失败，请重试")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Replace the current edit page in history with the message detail page
    // If message is not loaded yet, just go back in history
    if (message) {
      router.replace(`/status/${message.id}`)
    } else {
      router.back()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !message) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">{error || "Message not found"}</p>
        <Button onClick={() => router.replace('/')}>返回首页</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleCancel}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">编辑消息</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCancel}
            disabled={isSaving}
            variant="ghost"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-20"
          >
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-125">
        <TipTapEditor
          content={content}
          onChange={setContent}
          placeholder="输入内容..."
          className="h-full min-h-125 border-0"
          editorContentClassName="h-full min-h-125 px-4 py-4"
        />
      </div>
    </div>
  )
}
