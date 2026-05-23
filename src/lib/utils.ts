import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 获取用户头像 URL
 * 如果用户是 GoldieRill AI 机器人，返回自定义 logo
 * 如果用户没有设置头像，返回默认 Goldie Logo
 * @param name 用户名称
 * @param avatar 原始头像 URL
 * @returns 头像 URL
 */
export function getAvatarUrl(name: string | null, avatar: string | null): string | null {
  // 如果用户名是 "GoldieRill" 或者是 null（默认为 GoldieRill），使用 goldielogo.svg
  if (!name || name === "GoldieRill") {
    return "/goldielogoL.svg"
  }
  // 如果用户没有设置头像，使用默认 Goldie Logo
  if (!avatar) {
    return "/goldielogoL.svg"
  }
  return avatar
}

/**
 * 判断用户是否是 GoldieRill AI 机器人
 * @param name 用户名称
 * @returns 是否是 GoldieRill
 */
export function isGoldieRill(name: string | null): boolean {
  return !name || name === "GoldieRill"
}

/**
 * 判断头像 URL 是否为默认 logo（白色 SVG，浅色模式下需要反转）
 */
export function isDefaultAvatar(url: string | null | undefined): boolean {
  return !url || url === "/goldielogoL.svg"
}

/**
 * 获取用户 handle (@username)
 * @param email 用户邮箱
 * @param hasAuthor 是否有作者
 * @returns handle（不包含 @ 符号）
 */
export function getHandle(email: string | null, hasAuthor: boolean): string {
  if (!hasAuthor) return "AI"
  if (!email) return "user"
  return email.split('@')[0]
}
