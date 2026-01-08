"use client"

import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { TipTapViewer } from "@/components/TipTapViewer"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { GoldieAvatar } from "@/components/GoldieAvatar"

interface QuotedMessage {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  } | null
}

interface QuotedMessageCardProps {
  message: QuotedMessage
  className?: string
}

export function QuotedMessageCard({ message, className }: QuotedMessageCardProps) {
  const router = useRouter()

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN,
      })
    } catch {
      return ""
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/status/${message.id}`)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "mt-3 border border-border rounded-2xl p-3 cursor-pointer hover:bg-muted/30 transition-colors",
        className
      )}
    >
      {/* Header: Author info */}
      <div className="flex items-center gap-2 text-sm mb-2">
        <GoldieAvatar
          name={message.author?.name || null}
          avatar={message.author?.avatar || null}
          size="sm"
          isAI={!message.author}
        />
        {message.author ? (
          <>
            <span className="font-bold text-foreground">
              {message.author.name || "GoldieRill"}
            </span>
            <span className="text-muted-foreground">
              @{message.author.email?.split('@')[0] || "user"}
            </span>
          </>
        ) : (
          <>
            <span className="font-bold text-purple-600">
              AI 助手
            </span>
            <span className="text-muted-foreground">
              @assistant
            </span>
          </>
        )}
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {formatTime(message.createdAt)}
        </span>
      </div>

      {/* Message Content - truncated to 2 lines */}
      <div className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
        <TipTapViewer content={message.content} />
      </div>
    </div>
  )
}
