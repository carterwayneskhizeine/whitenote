"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { TipTapViewer } from "@/components/TipTapViewer"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface QuotedMessage {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  }
}

interface QuotedMessageCardProps {
  message: QuotedMessage
  className?: string
}

export function QuotedMessageCard({ message, className }: QuotedMessageCardProps) {
  const router = useRouter()

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

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
        <Avatar className="h-5 w-5">
          <AvatarImage src={message.author.avatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
            {getInitials(message.author.name)}
          </AvatarFallback>
        </Avatar>
        <span className="font-bold text-foreground">
          {message.author.name || "Anonymous"}
        </span>
        <span className="text-muted-foreground">
          @{message.author.email?.split('@')[0] || "user"}
        </span>
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
