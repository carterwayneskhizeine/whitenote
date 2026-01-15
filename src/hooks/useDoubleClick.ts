import { useRef, useCallback } from 'react'

interface UseDoubleClickOptions {
  onDoubleClick: () => void
  delay?: number // 双击间隔时间（毫秒），桌面端默认 1000ms
  forceMobile?: boolean // 强制使用移动端单击模式
}

export function useDoubleClick({ onDoubleClick, delay = 1000, forceMobile }: UseDoubleClickOptions) {
  const lastClickTime = useRef<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback((e: React.MouseEvent) => {
    // 移动端模式：直接触发单击
    if (forceMobile) {
      onDoubleClick()
      return
    }

    const now = Date.now()
    const timeSinceLastClick = now - lastClickTime.current

    // 清除之前的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // 如果距离上次点击在指定时间内，触发双击
    if (timeSinceLastClick > 0 && timeSinceLastClick <= delay) {
      onDoubleClick()
      lastClickTime.current = 0
    } else {
      // 第一次点击，设置定时器重置
      lastClickTime.current = now
      timerRef.current = setTimeout(() => {
        lastClickTime.current = 0
        timerRef.current = null
      }, delay)
    }
  }, [onDoubleClick, delay, forceMobile])
}
