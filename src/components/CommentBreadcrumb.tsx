"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface CommentBreadcrumbProps {
  messageId: string
  parentId?: string | null
  onNavigateBack: (targetId: string) => void
}

export function CommentBreadcrumb({ messageId, parentId, onNavigateBack }: CommentBreadcrumbProps) {
  const handleBack = () => {
    if (parentId) {
      // 返回到父评论页
      onNavigateBack(parentId)
    } else {
      // 返回到主消息页
      onNavigateBack(messageId)
    }
  }

  return (
    <div className="flex items-center px-4 h-[53px]">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={handleBack}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* 标题 */}
      <h1 className="text-xl font-bold">帖子</h1>
    </div>
  )
}
