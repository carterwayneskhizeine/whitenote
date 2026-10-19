"use client"

import { ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/useAppStore"

interface NewMessageButtonProps {
  onClick: () => void
}

export function NewMessageButton({ onClick }: NewMessageButtonProps) {
  const newMessageIds = useAppStore((state) => state.newMessageIds)

  if (newMessageIds.length === 0) {
    return null
  }

  return (
    // 固定在信息流顶部居中（与 X/Twitter 的「Show new posts」位置一致）。
    // 外层 h-0 + sticky：按钮浮在内容之上，不占用文档流高度，因此出现/消失时不会顶动信息流。
    // top-2 对应移动端（顶栏滚动时自动隐藏）；desktop:top-12 让按钮停在 48px 的桌面顶栏下方。
    // 配色刻意与主题反相：浅色模式黑底白字，深色模式白底黑字，两种主题下都保持高对比度。
    <div className="sticky top-2 desktop:top-12 z-50 h-0 pointer-events-none">
      <div className="flex justify-center">
        <Button
          onClick={onClick}
          size="lg"
          className="pointer-events-auto gap-2 rounded-xl text-base font-semibold shadow-lg animate-in fade-in slide-in-from-top-2 bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
        >
          <ArrowDown className="h-5 w-5" />
          <span>
            {newMessageIds.length > 1
              ? `${newMessageIds.length} 条新消息`
              : "有新消息"}
          </span>
        </Button>
      </div>
    </div>
  )
}
