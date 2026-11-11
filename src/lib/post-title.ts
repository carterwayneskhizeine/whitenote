/**
 * 从帖子 markdown 正文中提取标题。
 *
 * 纯函数、零依赖（无 server-only / node API），
 * 供 generateMetadata（Server Component）与 Route Handler 共用，
 * 保证 <title> / og:title / 导出文件头使用同一个标题来源。
 */

const DEFAULT_MAX_LEN = 80
const FALLBACK_TITLE = "未命名笔记"

// ATX heading：行首最多 3 个空格 + 1-6 个 # + 至少一个空格 + 内容（可带收尾 #）
const ATX_HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/

/**
 * 清理标题候选串：图片取 alt、链接取文本、去强调/删除线/行内代码标记、
 * 行首引用与列表标记、HTML 标签；连续空白折叠为单个空格。
 */
function cleanCandidate(raw: string): string {
  return raw
    // 图片 ![alt](url) → alt（需先于链接替换，避免只留下 "!"）
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    // 链接 [text](url) → text
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    // 强调（** __ * _）、删除线（~~）、行内代码（`）
    .replace(/[*_~`]+/g, "")
    // 行首 blockquote 标记（含嵌套 >>）
    .replace(/^>{1,6}\s*/, "")
    // 行首列表标记（- * + 或 1.）
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
    // HTML 标签
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    // 连续空白折叠
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * 按 Unicode 码点截断（Array.from），不会把代理对（emoji 等）切成两半。
 */
function truncate(str: string, maxLen: number): string {
  const chars = Array.from(str)
  if (chars.length <= maxLen) return str
  return chars.slice(0, maxLen).join("") + "…"
}

/**
 * 提取帖子标题：
 *   1. 前 30 个非空行中的首个 ATX heading 文本；
 *   2. 否则首个非空行；
 *   3. 否则「未命名笔记」。
 * 候选清理后为空则顺延到下一个候选；最终按 maxLen 码点截断（超出补「…」）。
 */
export function getPostTitle(markdown: string, maxLen: number = DEFAULT_MAX_LEN): string {
  const nonEmptyLines = markdown.split(/\r?\n/).filter((line) => line.trim().length > 0)

  // 候选一：heading 文本
  const headingLine = nonEmptyLines.slice(0, 30).find((line) => ATX_HEADING_RE.test(line))
  if (headingLine) {
    const cleaned = cleanCandidate(headingLine.match(ATX_HEADING_RE)?.[1] ?? "")
    if (cleaned) return truncate(cleaned, maxLen)
  }

  // 候选二：首个非空行
  if (nonEmptyLines.length > 0) {
    const cleaned = cleanCandidate(nonEmptyLines[0])
    if (cleaned) return truncate(cleaned, maxLen)
  }

  return truncate(FALLBACK_TITLE, maxLen)
}
