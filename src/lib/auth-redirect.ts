import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

// 防止重复跳转的标志
let isRedirecting = false

/**
 * 处理 401 错误并跳转到登录页
 * 使用 Next.js router 而不是 window.location.href，更可靠
 */
export function handle401Error() {
  if (isRedirecting || typeof window === 'undefined') {
    return
  }

  // 检查是否已经在登录页
  if (window.location.pathname === '/login') {
    return
  }

  isRedirecting = true

  // 使用 window.location.href 而不是 router.push
  // 因为这是一个非 React 环境的工具函数
  window.location.href = '/login'
}

/**
 * 重置重定向标志（用于测试）
 */
export function resetRedirectFlag() {
  isRedirecting = false
}

/**
 * React Hook：处理 401 错误并自动跳转
 * 在组件中使用，可以访问 Next.js router
 */
export function useAuthRedirect() {
  const router = useRouter()
  const redirectingRef = useRef(false)

  useEffect(() => {
    return () => {
      // 组件卸载时重置标志
      redirectingRef.current = false
    }
  }, [])

  const handleRedirect = () => {
    if (redirectingRef.current || typeof window === 'undefined') {
      return
    }

    // 检查是否已经在登录页
    if (window.location.pathname === '/login') {
      return
    }

    redirectingRef.current = true

    // 使用 Next.js router 进行跳转（在 React 组件中更可靠）
    router.push('/login')
  }

  return handleRedirect
}
