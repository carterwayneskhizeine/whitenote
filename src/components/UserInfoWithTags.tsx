"use client"

import { GoldieAvatar } from "@/components/GoldieAvatar"
import { Bot } from "lucide-react"
import { cn, getHandle } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

export interface UserInfoWithTagsProps {
  // User info
  author?: {
    name: string | null
    avatar: string | null
    email: string | null
  } | null
  createdAt: string
  updatedAt?: string
  tags?: Array<{
    tag: {
      id: string
      name: string
      color?: string | null
    }
  }>

  // AI Bot indicator
  isAIBot?: boolean
  showAIIndicator?: boolean

  // Styling
  size?: "sm" | "md" | "lg"
  align?: "baseline" | "center"
  nameClassName?: string
  handleClassName?: string
  timeClassName?: string
  tagClassName?: string
  containerClassName?: string

  // Interactions
  showNameUnderline?: boolean
  showTimeUnderline?: boolean
  onNameClick?: () => void
}

const sizeConfig = {
  sm: {
    avatar: "sm" as const,
    name: "text-xs",
    handle: "text-xs",
    time: "text-xs",
    botIcon: "h-3 w-3",
    tag: "text-[10px]",
  },
  md: {
    avatar: "md" as const,
    name: "text-sm",
    handle: "text-sm",
    time: "text-sm",
    botIcon: "h-3.5 w-3.5",
    tag: "text-xs",
  },
  lg: {
    avatar: "lg" as const,
    name: "text-base",
    handle: "text-sm",
    time: "text-sm",
    botIcon: "h-4 w-4",
    tag: "text-sm",
  },
} as const

export function UserInfoWithTags({
  author,
  createdAt,
  updatedAt,
  tags,
  isAIBot,
  showAIIndicator = true,
  size = "md",
  align = "baseline",
  nameClassName,
  handleClassName,
  timeClassName,
  tagClassName,
  containerClassName,
  showNameUnderline = true,
  showTimeUnderline = true,
  onNameClick,
}: UserInfoWithTagsProps) {
  const config = sizeConfig[size]

  // Format time
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

  // Check if content has been edited
  const isEdited = updatedAt && new Date(updatedAt).getTime() > new Date(createdAt).getTime() + 1000

  // Use updated time if edited, otherwise use created time
  const displayTime = isEdited ? updatedAt : createdAt

  // Check if this is an AI assistant
  const isAI = isAIBot || !author

  return (
    <div
      className={cn(
        "flex items-center gap-1 flex-wrap",
        align === "baseline" ? "items-baseline" : "items-center",
        containerClassName
      )}
    >
      {/* Avatar - shown in card headers like QuotedMessageCard */}
      {size === "sm" && (
        <GoldieAvatar
          name={author?.name || null}
          avatar={author?.avatar || null}
          size={config.avatar}
          isAI={isAI}
        />
      )}

      {/* Name */}
      {author ? (
        <span
          className={cn(
            "font-bold text-foreground",
            showNameUnderline && "hover:underline",
            config.name,
            nameClassName
          )}
          onClick={onNameClick}
        >
          {author.name || "GoldieRill"}
        </span>
      ) : (
        <span
          className={cn(
            "font-bold text-purple-600",
            showNameUnderline && "hover:underline",
            config.name,
            nameClassName
          )}
          onClick={onNameClick}
        >
          AI Assistant
        </span>
      )}

      {/* Handle */}
      <span className={cn("text-muted-foreground", config.handle, handleClassName)}>
        @{getHandle(author?.email || null, !!author)}
      </span>

      {/* Separator */}
      <span className={cn("text-muted-foreground", config.time)}>·</span>

      {/* Time - show edited time if content was edited */}
      <span
        className={cn(
          "text-muted-foreground",
          showTimeUnderline && "hover:underline",
          config.time,
          timeClassName
        )}
      >
        {formatTime(displayTime)}
      </span>

      {/* Edited indicator - only show if edited (for clarity) */}
      {isEdited && (
        <>
          <span className={cn("text-muted-foreground", config.time)}>·</span>
          <span className={cn("text-muted-foreground", config.time)}>
            已编辑
          </span>
        </>
      )}

      {/* AI Bot Indicator */}
      {isAI && showAIIndicator && size !== "sm" && (
        <Bot className={cn(config.botIcon, "text-primary ml-1")} />
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {tags.map(({ tag }) => (
            <span
              key={tag.id}
              className={cn(
                "text-primary hover:underline cursor-pointer",
                config.tag,
                tagClassName
              )}
            >
              #{tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
