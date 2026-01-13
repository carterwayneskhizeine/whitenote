"use client"

import { Comment } from "@/types/api"
import { cn } from "@/lib/utils"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { TipTapViewer } from "@/components/TipTapViewer"
import { MediaGrid } from "@/components/MediaGrid"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"
import { ActionRow } from "@/components/ActionRow"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bot, Edit2, Trash2, MoreVertical } from "lucide-react"
import { getHandle } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

export interface CommentItemProps {
  comment: Comment
  // 点击行为
  onClick?: () => void
  // 下拉菜单配置
  showMenu?: boolean
  onEditClick?: (e: React.MouseEvent) => void
  onDeleteClick?: (e: React.MouseEvent) => void
  // ActionRow 配置
  replyCount?: number
  onReply?: (e: React.MouseEvent) => void
  copied?: boolean
  onCopy?: (e: React.MouseEvent) => void
  retweetCount?: number
  onRetweet?: (e: React.MouseEvent) => void
  starred?: boolean
  onToggleStar?: (e: React.MouseEvent) => void
  onShare?: (e: React.MouseEvent) => void
  // 图片点击
  onImageClick?: (index: number, e: React.MouseEvent) => void
  // 样式配置
  size?: "sm" | "md" | "lg"
  actionRowSize?: "sm" | "md" | "lg"
  className?: string
}

const sizeConfig = {
  sm: {
    avatar: "md" as const,
    name: "text-xs",
    handle: "text-xs",
    time: "text-xs",
    botIcon: "h-3 w-3",
    tag: "text-[10px]",
    menuButton: "h-5 w-5",
    menuIcon: "h-3 w-3",
    content: "text-xs",
  },
  md: {
    avatar: "lg" as const,
    name: "text-sm",
    handle: "text-sm",
    time: "text-sm",
    botIcon: "h-3.5 w-3.5",
    tag: "text-xs",
    menuButton: "h-6 w-6",
    menuIcon: "h-3.5 w-3.5",
    content: "text-sm",
  },
  lg: {
    avatar: "xl" as const,
    name: "text-base",
    handle: "text-sm",
    time: "text-sm",
    botIcon: "h-4 w-4",
    tag: "text-sm",
    menuButton: "h-7 w-7",
    menuIcon: "h-4 w-4",
    content: "text-sm",
  },
} as const

export function CommentItem({
  comment,
  onClick,
  showMenu = true,
  onEditClick,
  onDeleteClick,
  replyCount = 0,
  onReply,
  copied = false,
  onCopy,
  retweetCount = 0,
  onRetweet,
  starred = false,
  onToggleStar,
  onShare,
  onImageClick,
  size = "md",
  actionRowSize = "sm",
  className,
}: CommentItemProps) {
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

  return (
    <div
      className={cn("p-4 border-b hover:bg-muted/5 transition-colors", onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <GoldieAvatar
          name={comment.author?.name || null}
          avatar={comment.author?.avatar || null}
          size={config.avatar}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: User Info + Menu */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {/* Name */}
              <span className={cn("font-bold hover:underline", config.name)}>
                {comment.author?.name || "GoldieRill"}
              </span>

              {/* Handle */}
              <span className={cn("text-muted-foreground", config.handle)}>
                @{getHandle(comment.author?.email || null, !!comment.author)}
              </span>

              {/* Separator */}
              <span className={cn("text-muted-foreground", config.time)}>·</span>

              {/* Time */}
              <span className={cn("text-muted-foreground hover:underline", config.time)}>
                {formatTime(comment.createdAt)}
              </span>

              {/* AI Bot Indicator */}
              {comment.isAIBot && (
                <Bot className={cn(config.botIcon, "text-primary ml-1")} />
              )}

              {/* Tags */}
              {comment.tags && comment.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  {comment.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className={cn("text-primary hover:underline cursor-pointer", config.tag)}
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdown Menu */}
            {showMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full",
                      config.menuButton
                    )}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                    }}
                  >
                    <MoreVertical className={config.menuIcon} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEditClick && (
                    <DropdownMenuItem onClick={onEditClick}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      编辑
                    </DropdownMenuItem>
                  )}
                  {onDeleteClick && (
                    <DropdownMenuItem onClick={onDeleteClick} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Content */}
          <div className={cn("mt-1 leading-normal wrap-break-word", config.content)}>
            <TipTapViewer content={comment.content} />
          </div>

          {/* Media Display */}
          <MediaGrid
            medias={comment.medias || []}
            onImageClick={(index, e) => {
              e.stopPropagation()
              onImageClick?.(index, e)
            }}
            className="mt-2"
          />

          {/* Quoted Message Card */}
          {comment.quotedMessage && (
            <QuotedMessageCard
              message={comment.quotedMessage}
              className="mt-2"
            />
          )}

          {/* Action Row */}
          <ActionRow
            replyCount={replyCount}
            onReply={onReply}
            copied={copied}
            onCopy={onCopy}
            retweetCount={retweetCount}
            onRetweet={onRetweet}
            starred={starred}
            onToggleStar={onToggleStar}
            onShare={onShare}
            size={actionRowSize}
            className="mt-3"
          />
        </div>
      </div>
    </div>
  )
}
