import { Marked } from 'marked'
import { Markdown } from '@tiptap/markdown'

/** @tiptap/markdown 期望的 marked 实例类型(其内部依赖的 marked v17) */
type TiptapMarked = NonNullable<
  NonNullable<Parameters<typeof Markdown.configure>[0]>['marked']
>

/**
 * 创建一个禁用了 GFM 裸链接自动识别的 marked 实例。
 *
 * marked 的 `url` tokenizer 会在解析时把 http://127.0.0.1:5166/admin/、
 * www.example.com 这类裸 URL 自动转成 <a> 链接,导致原始输入被改变。
 * 覆盖该 tokenizer 并返回 undefined(而非 false,false 会回退到原实现),
 * 使 lexer 跳过自动链接、按纯文本处理,原样保留输入。
 *
 * 注意:
 * - 显式 markdown 链接语法 [text](url) 走的是 `link` tokenizer,不受影响。
 * - 每次调用返回全新实例(@tiptap/markdown 会在实例上注册扩展,不能跨编辑器共享)。
 */
export function createPlainMarked(): TiptapMarked {
  const instance = new Marked()
  instance.use({
    tokenizer: {
      url: () => undefined,
    },
  })
  // 本项目 marked v18 与 @tiptap/markdown 内部的 marked v17 类型定义不同,
  // 但扩展只用 Lexer/lexer/use/setOptions 这些稳定 API,运行时完全兼容
  return instance as unknown as TiptapMarked
}
