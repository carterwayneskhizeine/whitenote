"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, getAvatarUrl, isGoldieRill } from "@/lib/utils"

interface GoldieAvatarProps {
  /** 用户名称 */
  name: string | null
  /** 用户头像 URL */
  avatar: string | null
  /** 头像大小，默认为 "h-8 w-8" */
  size?: "sm" | "md" | "lg" | "xl"
  /** 额外的 className */
  className?: string
  /** 是否显示为 AI 助手样式（当没有 author 时） */
  isAI?: boolean
}

const sizeClasses = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-9 w-9",
  xl: "h-12 w-12",
}

const fallbackSizeClasses = {
  sm: "text-[10px] font-semibold",
  md: "text-xs font-semibold",
  lg: "text-xs font-semibold",
  xl: "text-sm font-semibold",
}

/**
 * GoldieAvatar - 统一的头像组件
 *
 * 自动处理 GoldieRill AI 机器人的头像显示：
 * - 使用自定义 logo
 * - 亮色模式下反色显示，暗色模式下保持原样
 *
 * @example
 * ```tsx
 * <GoldieAvatar name={user.name} avatar={user.avatar} size="md" />
 * ```
 */
export function GoldieAvatar({
  name,
  avatar,
  size = "md",
  className,
  isAI = false,
}: GoldieAvatarProps) {
  const getInitials = (userName: string | null) => {
    if (!userName) return "U"
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // 如果是 AI 助手且没有 author
  if (isAI) {
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold">
          AI
        </AvatarFallback>
      </Avatar>
    )
  }

  const avatarUrl = getAvatarUrl(name, avatar)

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          className={isGoldieRill(name) ? "invert dark:invert-0" : undefined}
        />
      )}
      <AvatarFallback className={cn("bg-primary/10 text-primary", fallbackSizeClasses[size])}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
