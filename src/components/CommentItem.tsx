"use client"

import { useState, useEffect, useRef } from "react"
import { Comment } from "@/types/api"
import { cn } from "@/lib/utils"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { UserInfoWithTags } from "@/components/UserInfoWithTags"
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
import { Edit2, Trash2, MoreVertical } from "lucide-react"
import { useDoubleClick } from "@/hooks/useDoubleClick"
import { useMobile } from "@/hooks/use-mobile"

export interface CommentItemProps {
  comment: Comment
  // 点击行为（移动端单击触发，桌面端双击触发）
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
  // markdown 图片点击
  onMarkdownImageClick?: (index: number, url: string) => void
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
  onMarkdownImageClick,
  size = "md",
  actionRowSize = "sm",
  className,
}: CommentItemProps) {
  const config = sizeConfig[size]
  const contentRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  // 检测内容是否需要"显示更多"按钮
  useEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current) {
        const el = contentRef.current
        // 当应用 line-clamp 后，如果 scrollHeight > clientHeight 说明内容被裁剪了
        setHasMore(el.scrollHeight > el.clientHeight)
      }
    }

    // 多次检测以确保 TipTapViewer 内容完全渲染
    const timer1 = setTimeout(checkOverflow, 100)
    const timer2 = setTimeout(checkOverflow, 300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [comment.content])

  // 移动端单击、桌面端双击（1秒内）
  const isMobile = useMobile()
  const handleClick = useDoubleClick({
    onDoubleClick: () => onClick?.(),
    forceMobile: isMobile,
  })

  return (
    <div
      className={cn("p-4 border-b hover:bg-muted/5 transition-colors", onClick && "cursor-pointer", className)}
      onClick={handleClick}
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
            <UserInfoWithTags
              author={comment.author}
              createdAt={comment.createdAt}
              updatedAt={comment.updatedAt}
              tags={comment.tags}
              isAIBot={comment.isAIBot}
              size={size}
              align="center"
            />

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
          <div
              ref={contentRef}
              className={cn(
                "mt-1 leading-normal wrap-break-word text-foreground overflow-hidden",
                config.content,
                !isExpanded && "line-clamp-9"
              )}
              style={!isExpanded ? {
                display: '-webkit-box',
                WebkitLineClamp: 9,
                WebkitBoxOrient: 'vertical',
              } : {}}
            >
              <TipTapViewer content={comment.content} onImageClick={onMarkdownImageClick} />
            </div>
            {hasMore && !isExpanded && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsExpanded(true)
                }}
                className="text-primary text-sm font-medium mt-1 hover:underline text-left w-fit"
              >
                显示更多
              </button>
            )}

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
