import { Marked } from 'marked'

/**
 * share 页用的 marked 渲染：与全局 marked 行为一致（GFM 等），
 * 唯一区别是 ```mermaid 代码块不输出 <pre>，而是输出一个占位 div，
 * 由客户端组件 MermaidRenderer 水合成可缩放/全屏的图表查看器。
 *
 * 占位结构里用 hidden 的 <pre> 携带源码（textContent 读取，天然免转义问题），
 * 服务端只做 HTML 转义防止源码中的字符破坏结构。
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdownWithMermaid(source: string): string {
  const instance = new Marked()
  instance.use({
    renderer: {
      code(token) {
        const lang = (token.lang || '').trim().toLowerCase()
        if (lang !== 'mermaid') return false // 其余语言走 marked 默认渲染
        return `<div class="whitenote-mermaid" data-mermaid-placeholder><pre class="mermaid-source" hidden>${escapeHtml(token.text ?? '')}</pre></div>`
      },
    },
  })
  return instance.parse(source, { async: false }) as string
}
