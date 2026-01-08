import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 获取用户头像 URL
 * 如果用户是 GoldieRill AI 机器人，返回自定义 logo
 * @param name 用户名称
 * @param avatar 原始头像 URL
 * @returns 头像 URL
 */
export function getAvatarUrl(name: string | null, avatar: string | null): string | null {
  // 如果用户名是 "GoldieRill" 或者是 null（默认为 GoldieRill），使用 goldielogo.svg
  if (!name || name === "GoldieRill") {
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
