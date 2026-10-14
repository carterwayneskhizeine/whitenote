"use client"

import { useEffect } from 'react'
import { mountMermaidViewer } from '@/lib/mermaid-viewer'

/**
 * 扫描页面中的 mermaid 占位符（.whitenote-mermaid，由服务端
 * renderMarkdownWithMermaid 生成）并水合为可缩放/全屏的图表查看器。
 *
 * 在任意包含 mermaid 内容的页面挂载一次即可（全 document 扫描）。
 * 用 dataset 守卫防止重复挂载；额外延时扫描兜底 SSR 后到齐的内容。
 */
export function MermaidRenderer() {
  useEffect(() => {
    const cleanups: Array<() => void> = []
    let cancelled = false

    const mountAll = () => {
      const placeholders = document.querySelectorAll<HTMLElement>(
        '[data-mermaid-placeholder]:not([data-mermaid-mounted])'
      )
      placeholders.forEach((placeholder) => {
        placeholder.dataset.mermaidMounted = 'true'
        const source = placeholder.querySelector<HTMLPreElement>('.mermaid-source')
        const code = source?.textContent ?? ''
        const dark = document.documentElement.classList.contains('dark')
        placeholder.hidden = false
        mountMermaidViewer(placeholder, code, { dark })
          .then((cleanup) => {
            if (cancelled) cleanup()
            else cleanups.push(cleanup)
          })
          .catch(() => {
            // 渲染失败时 viewer 内部已展示错误信息，这里无需处理
          })
      })
    }

    mountAll()
    const timer1 = setTimeout(mountAll, 300)
    const timer2 = setTimeout(mountAll, 1200)

    return () => {
      cancelled = true
      clearTimeout(timer1)
      clearTimeout(timer2)
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  return null
}
