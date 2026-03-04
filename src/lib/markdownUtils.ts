/**
 * Server-safe markdown utilities (no browser APIs, no external deps).
 *
 * 这两个函数专门服务于分享页的"AI 友好"需求：
 *   - mdToText  → 去掉所有 markdown 语法，得到纯文本（用于 JSON-LD articleBody）
 *   - mdToHtml  → 将 markdown 转成语义化 HTML（用于 clean view 服务端渲染）
 *
 * 支持的 markdown 语法：
 *   标题 h1-h6 · 段落 · 换行 · 粗体 · 斜体 · 删除线
 *   行内代码 · 围栏代码块（带语言标签）· 引用块
 *   无序列表 · 有序列表 · 链接 · 图片
 */

// ── 纯文本提取 ────────────────────────────────────────────────────────────────

/**
 * 将 markdown 转为纯文本。
 * 用于填充 JSON-LD 的 articleBody 字段。
 */
export function mdToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")               // 去掉围栏代码块
    .replace(/`([^`]+)`/g, "$1")                  // 行内代码 → 文本
    .replace(/!\[.*?\]\(.*?\)/g, "")              // 去掉图片
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")        // 链接 → 链接文字
    .replace(/^#{1,6}\s+/gm, "")                  // 去掉标题 #
    .replace(/[*_~]{1,2}([^*_~\n]+)[*_~]{1,2}/g, "$1") // 粗/斜/删除线 → 文本
    .replace(/^\s*[-*+]\s+/gm, "")                // 去掉无序列表符号
    .replace(/^\s*\d+\.\s+/gm, "")               // 去掉有序列表序号
    .replace(/^\s*>\s*/gm, "")                    // 去掉引用 >
    .replace(/\n{2,}/g, " ")                      // 多个空行 → 空格
    .trim()
}

// ── Markdown → 语义化 HTML ────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 处理行内 markdown 语法（粗体、斜体、删除线、链接、图片、行内代码）。*/
function processInline(line: string): string {
  return line
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
}

/**
 * 将 markdown 转为语义化 HTML。
 * 输出包含 h1-h6, p, ul/ol/li, blockquote, pre/code 等标准标签，
 * 便于外部 AI 工具直接读取并转换为结构化格式（如 Markdown、摘要）。
 *
 * 设计目标：零依赖、零运行时副作用，可在 Next.js Server Component 中直接调用。
 */
export function mdToHtml(md: string): string {
  // ① 先把围栏代码块替换为占位符，避免内部内容被行内规则处理
  const codeBlocks: string[] = []
  const withPlaceholders = md.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_, lang: string, code: string) => {
      const idx = codeBlocks.length
      const langAttr = lang ? ` class="language-${lang}"` : ""
      codeBlocks.push(
        `<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`
      )
      return `\x00CODE${idx}\x00`
    }
  )

  const lines = withPlaceholders.split("\n")
  const output: string[] = []

  type ListType = "ul" | "ol"
  let currentList: ListType | null = null
  const pendingParagraph: string[] = []

  const flushParagraph = () => {
    if (pendingParagraph.length > 0) {
      output.push(`<p>${pendingParagraph.join("<br>")}</p>`)
      pendingParagraph.length = 0
    }
  }

  const flushList = () => {
    if (currentList) {
      output.push(`</${currentList}>`)
      currentList = null
    }
  }

  for (const rawLine of lines) {
    // ── 围栏代码块占位符 ──
    if (/\x00CODE\d+\x00/.test(rawLine)) {
      flushParagraph()
      flushList()
      const restored = rawLine.replace(
        /\x00CODE(\d+)\x00/g,
        (_, i) => codeBlocks[Number(i)]
      )
      output.push(restored)
      continue
    }

    // ── 标题 h1–h6 ──
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      output.push(
        `<h${level}>${processInline(headingMatch[2])}</h${level}>`
      )
      continue
    }

    // ── 水平线 ──
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(rawLine)) {
      flushParagraph()
      flushList()
      output.push("<hr>")
      continue
    }

    // ── 引用块 ──
    const bqMatch = rawLine.match(/^\s*>\s?(.*)/)
    if (bqMatch) {
      flushParagraph()
      flushList()
      output.push(`<blockquote>${processInline(bqMatch[1])}</blockquote>`)
      continue
    }

    // ── 无序列表 ──
    const ulMatch = rawLine.match(/^\s*[-*+]\s+(.+)/)
    if (ulMatch) {
      flushParagraph()
      if (currentList !== "ul") {
        flushList()
        output.push("<ul>")
        currentList = "ul"
      }
      output.push(`<li>${processInline(ulMatch[1])}</li>`)
      continue
    }

    // ── 有序列表 ──
    const olMatch = rawLine.match(/^\s*\d+\.\s+(.+)/)
    if (olMatch) {
      flushParagraph()
      if (currentList !== "ol") {
        flushList()
        output.push("<ol>")
        currentList = "ol"
      }
      output.push(`<li>${processInline(olMatch[1])}</li>`)
      continue
    }

    // ── 空行：结束当前段落 / 列表 ──
    if (rawLine.trim() === "") {
      flushList()
      flushParagraph()
      continue
    }

    // ── 普通文本行：累积为段落 ──
    flushList()
    pendingParagraph.push(processInline(rawLine))
  }

  flushList()
  flushParagraph()

  return output.join("\n")
}
