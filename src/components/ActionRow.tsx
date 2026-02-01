"use client"

import { MessageCircle, Repeat2, Share, Bookmark, BookmarkCheck, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ActionRowProps {
  // 回复相关
  replyCount?: number
  onReply?: (e: React.MouseEvent) => void
  showReplyCount?: boolean

  // 复制相关
  copied?: boolean
  onCopy?: (e: React.MouseEvent) => void

  // 转推相关
  retweetCount?: number
  onRetweet?: (e: React.MouseEvent) => void
  showRetweetCount?: boolean

  // 收藏相关
  starred?: boolean
  onToggleStar?: (e: React.MouseEvent) => void

  // 分享相关
  onShare?: (e: React.MouseEvent) => void

  // 样式配置
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeConfig = {
  sm: {
    icon: "h-3.5 w-3.5",
    count: "text-xs",
    padding: "p-1.5",
    container: "text-sm",
  },
  md: {
    icon: "h-4 w-4",
    count: "text-xs",
    padding: "p-2",
    container: "text-sm",
  },
  lg: {
    icon: "h-[22px] w-[22px]",
    count: "text-sm",
    padding: "p-2",
    container: "text-sm",
  },
} as const

export function ActionRow({
  replyCount = 0,
  onReply,
  showReplyCount = true,
  copied = false,
  onCopy,
  retweetCount = 0,
  onRetweet,
  showRetweetCount = true,
  starred = false,
  onToggleStar,
  onShare,
  size = "md",
  className,
}: ActionRowProps) {
  const config = sizeConfig[size]

  return (
    <div className={cn("flex items-center justify-between gap-2 text-muted-foreground", className)}>
      {/* Reply Button */}
      {(onReply || (showReplyCount && replyCount > 0)) && (
        <div
          className={cn("group flex items-center", onReply && "cursor-pointer")}
          onClick={onReply}
        >
          <div className={cn(config.padding, "rounded-full", onReply && "group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors")}>
            <MessageCircle className={cn(config.icon, "text-muted-foreground", onReply && "group-hover:text-blue-500 transition-colors")} />
          </div>
          {showReplyCount && replyCount > 0 && (
            <span className={cn("ml-1", config.count, onReply ? "text-muted-foreground group-hover:text-blue-500" : "text-muted-foreground", "transition-colors")}>
              {replyCount}
            </span>
          )}
        </div>
      )}

      {/* Copy Button */}
      {onCopy && (
        <div className="group flex items-center cursor-pointer" onClick={onCopy}>
          <div className={cn(
            config.padding,
            "rounded-full transition-colors",
            copied ? "bg-green-500/20" : "group-hover:bg-green-500/10"
          )}>
            <Copy className={cn(
              config.icon,
              "transition-colors",
              copied ? "text-green-500" : "text-muted-foreground group-hover:text-green-500"
            )} />
          </div>
        </div>
      )}

      {/* Retweet Button */}
      {onRetweet && (
        <div className="group flex items-center cursor-pointer" onClick={onRetweet}>
          <div className={cn(config.padding, "rounded-full group-hover:bg-green-500/10 transition-colors")}>
            <Repeat2 className={cn(config.icon, "text-muted-foreground group-hover:text-green-500 transition-colors")} />
          </div>
          {showRetweetCount && retweetCount > 0 && (
            <span className={cn("ml-1", config.count, "text-foreground/60 group-hover:text-green-600 transition-colors")}>
              {retweetCount}
            </span>
          )}
        </div>
      )}

      {/* Bookmark/Star Button */}
      {onToggleStar && (
        <div className="group flex items-center cursor-pointer" onClick={onToggleStar}>
          <div className={cn(config.padding, "rounded-full group-hover:bg-yellow-500/10 transition-colors")}>
            {starred ? (
              <BookmarkCheck className={cn(config.icon, "text-yellow-600 fill-yellow-600 transition-colors")} />
            ) : (
              <Bookmark className={cn(config.icon, "text-muted-foreground group-hover:text-yellow-600 transition-colors")} />
            )}
          </div>
        </div>
      )}

      {/* Share Button */}
      {onShare && (
        <div className="group flex items-center cursor-pointer" onClick={onShare}>
          <div className={cn(config.padding, "rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors")}>
            <Share className={cn(config.icon, "text-muted-foreground group-hover:text-blue-500 transition-colors")} />
          </div>
        </div>
      )}
    </div>
  )
}
