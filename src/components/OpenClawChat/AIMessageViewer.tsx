"use client"

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Image } from '@tiptap/extension-image'
import { common, createLowlight } from 'lowlight'
import { cn } from "@/lib/utils"
import type { ChatMessage, OpenClawContentBlock, OpenClawTextContent } from './types'
import { Terminal, FileText, Brain, ChevronRight, Clock } from 'lucide-react'

// Format timestamp to human-readable string
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()

  // Reset time to midnight for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  // Calculate difference in days
  const diffTime = today.getTime() - messageDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Format time as HH:MM
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const timeStr = `${hours}:${minutes}`

  if (diffDays === 0) {
    // Today - just show time
    return timeStr
  } else if (diffDays === 1) {
    // Yesterday
    return `昨天 ${timeStr}`
  } else {
    // Older - show month/day and time
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}月${day}日 ${timeStr}`
  }
}

interface AIMessageViewerProps {
  message: ChatMessage
  className?: string
}

// Helper to render tool call
function ToolCallBlock({ content }: { content: OpenClawContentBlock }) {
  if (content.type !== 'toolCall') return null

  const args = content.arguments as { command?: string; path?: string; limit?: number }

  const cleanName = content.name?.replace(/\s*\(call_[a-f0-9]+\)/g, '').trim() || ''
  const cleanCommand = args.command?.replace(/\(call_[a-f0-9]+\)/g, '').trim() || ''

  return (
    <div className="my-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
        <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          🔧 Tool Call: {cleanName}
        </span>
        {args.path && (
          <span className="text-xs ml-auto bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded text-blue-800 dark:text-blue-200">
            path: "{args.path}"
          </span>
        )}
      </div>
      {cleanCommand && (
        <div className="p-3 text-sm font-mono">
          <div className="mb-1">
            <span className="text-blue-600 dark:text-blue-400">Command:</span>
            <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap break-all">
              {cleanCommand}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper to render tool result
function ToolResultBlock({ message }: { message: ChatMessage }) {
  if (message.role !== 'toolResult') return null

  const toolMsg = message as any
  const content = toolMsg.content?.[0] as { text?: string }
  const text = content?.text || ''

  return (
    <div className="my-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800">
        <ChevronRight className="w-4 h-4 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          Tool Result: {toolMsg.toolName}
        </span>
        {toolMsg.details?.exitCode !== undefined && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200">
            Exit: {toolMsg.details.exitCode}
          </span>
        )}
      </div>
      <div className="p-3">
        <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all bg-white dark:bg-black/30 p-3 rounded border border-green-200 dark:border-green-800">
          {text}
        </pre>
        <div className="mt-2 flex items-center justify-between">
          {toolMsg.details?.durationMs && (
            <div className="text-xs text-green-600 dark:text-green-400">
              Duration: {toolMsg.details.durationMs}ms
            </div>
          )}
          {message.timestamp && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <Clock className="w-3 h-3" />
              <span>{formatTimestamp(message.timestamp)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to render thinking
function ThinkingBlock({ content }: { content: OpenClawContentBlock }) {
  if (content.type !== 'thinking') return null

  return (
    <div className="my-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800">
        <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          Thinking
        </span>
      </div>
      <div className="p-3 text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap">
        {content.thinking}
      </div>
    </div>
  )
}

export function AIMessageViewer({
  message,
  className
}: AIMessageViewerProps) {
  const lowlight = createLowlight(common)

  // Extract text content for TipTap
  const getTextContent = () => {
    if (typeof message.content === 'string') {
      return message.content
    }

    if (Array.isArray(message.content)) {
      const textBlocks = message.content.filter((block): block is OpenClawTextContent => {
        return block.type === 'text'
      })
      return textBlocks.map((block) => (block as OpenClawTextContent).text).join('\n\n')
    }

    return ''
  }

  const textContent = getTextContent()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: false,
        },
      }),
    ],
    content: textContent,
    contentType: 'markdown',
    immediatelyRender: false,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none',
      },
    },
  })

  useEffect(() => {
    if (!editor) return

    const addCopyButtons = () => {
      const codeBlocks = editor.view.dom.querySelectorAll('pre')
      codeBlocks.forEach((pre: Element) => {
        if (pre.querySelector('.code-copy-btn')) return

        const button = document.createElement('button')
        button.className = 'code-copy-btn'
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
        button.setAttribute('aria-label', 'Copy code')
        button.setAttribute('type', 'button')

        const handleClick = async (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          const code = pre.querySelector('code')
          if (code) {
            const text = code.textContent || ''
            try {
              await navigator.clipboard.writeText(text)
              button.classList.add('copied')
              setTimeout(() => {
                button.classList.remove('copied')
              }, 1000)
            } catch (error) {
              console.error('Failed to copy code:', error)
            }
          }
        }

        button.addEventListener('click', handleClick)
        pre.appendChild(button)
      })
    }

    const timer = setTimeout(() => {
      addCopyButtons()
    }, 100)

    const observer = new MutationObserver(() => {
      addCopyButtons()
    })

    const editorElement = editor.view.dom
    observer.observe(editorElement, {
      childList: true,
      subtree: true,
    })

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [editor])

  if (!editor) {
    return null
  }

  // Render tool result messages
  if (message.role === 'toolResult') {
    return (
      <div className={cn("ai-message-viewer max-w-full", className)}>
        <ToolResultBlock message={message} />
      </div>
    )
  }

  // Render content blocks (thinking, toolCall, text)
  const contentBlocks = Array.isArray(message.content) ? message.content : []

  return (
    <div className={cn("ai-message-viewer max-w-full", className)}>
      {/* Render non-text blocks first */}
      {contentBlocks.map((block, idx) => {
        if (block.type === 'thinking') {
          return <ThinkingBlock key={`thinking-${idx}`} content={block} />
        }
        if (block.type === 'toolCall') {
          return <ToolCallBlock key={`toolcall-${idx}`} content={block} />
        }
        return null
      })}

      {/* Render text content with TipTap */}
      {textContent && <EditorContent editor={editor} />}

      {/* Timestamp */}
      {message.timestamp && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatTimestamp(message.timestamp)}</span>
        </div>
      )}

      <style jsx global>{`
        .ai-message-viewer .ProseMirror {
          outline: none;
          max-width: 100%;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .ai-message-viewer .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .ai-message-viewer .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.875rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .ai-message-viewer .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }

        .ai-message-viewer .ProseMirror h4,
        .ai-message-viewer .ProseMirror h5,
        .ai-message-viewer .ProseMirror h6 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .ai-message-viewer .ProseMirror p {
          margin-top: 0;
          margin-bottom: 0;
          line-height: 1.6;
        }

        .ai-message-viewer .ProseMirror pre {
          background-color: #1e1e1e;
          border-radius: 0.5rem;
          padding: 0.875rem 1rem;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
          overflow-x: visible;
          overflow-y: hidden;
          border: 1px solid #333333;
          position: relative;
          pointer-events: auto;
          white-space: pre;
        }

        .ai-message-viewer .ProseMirror pre code {
          display: block;
          overflow-x: auto;
          white-space: pre;
        }

        .ai-message-viewer .ProseMirror pre code::-webkit-scrollbar {
          height: 8px;
        }

        .ai-message-viewer .ProseMirror pre code::-webkit-scrollbar-track {
          background: #2d2d2d;
          border-radius: 4px;
        }

        .ai-message-viewer .ProseMirror pre code::-webkit-scrollbar-thumb {
          background: #555555;
          border-radius: 4px;
        }

        .ai-message-viewer .ProseMirror pre code::-webkit-scrollbar-thumb:hover {
          background: #666666;
        }

        .ai-message-viewer .ProseMirror pre .code-copy-btn {
          position: sticky;
          float: right;
          top: 0;
          margin-left: 0.5rem;
          background-color: rgba(30, 30, 30, 0.9);
          border: none;
          border-radius: 0.375rem;
          padding: 0.375rem;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s, color 0.2s;
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .ai-message-viewer .ProseMirror pre::-webkit-scrollbar {
          height: 8px;
        }

        .ai-message-viewer .ProseMirror pre::-webkit-scrollbar-track {
          background: #2d2d2d;
          border-radius: 4px;
        }

        .ai-message-viewer .ProseMirror pre::-webkit-scrollbar-thumb {
          background: #555555;
          border-radius: 4px;
        }

        .ai-message-viewer .ProseMirror pre::-webkit-scrollbar-thumb:hover {
          background: #666666;
        }

        .ai-message-viewer .ProseMirror pre code {
          background-color: transparent;
          padding: 0;
          font-size: 1.0em;
          color: inherit;
          font-family: 'JetBrainsMono', 'Fira Code', Consolas, Monaco, monospace;
          white-space: pre;
        }

        .ai-message-viewer .ProseMirror code {
          background-color: hsl(var(--muted) / 0.5);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: 'JetBrainsMono', 'Fira Code', Consolas, Monaco, monospace;
        }

        .ai-message-viewer .ProseMirror pre .code-copy-btn {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background-color: transparent;
          border: none;
          border-radius: 0.375rem;
          padding: 0.375rem;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s, color 0.2s;
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .ai-message-viewer .ProseMirror pre .code-copy-btn,
        :not(.dark) .ai-message-viewer .ProseMirror pre .code-copy-btn {
          color: #ffffff;
        }

        .dark .ai-message-viewer .ProseMirror pre .code-copy-btn {
          color: #ffffff;
        }

        .ai-message-viewer .ProseMirror pre:hover .code-copy-btn {
          opacity: 1;
        }

        .ai-message-viewer .ProseMirror pre .code-copy-btn.copied {
          color: #22c55e !important;
          opacity: 1 !important;
        }

        .ai-message-viewer .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1rem 0;
          overflow: hidden;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
        }

        .ai-message-viewer .ProseMirror table td,
        .ai-message-viewer .ProseMirror table th {
          min-width: 1em;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          background-color: hsl(var(--background));
        }

        .ai-message-viewer .ProseMirror table th {
          font-weight: 600;
          text-align: left;
          background-color: hsl(var(--muted) / 0.3);
        }

        .ai-message-viewer .ProseMirror table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: hsl(var(--primary) / 0.1);
          pointer-events: none;
        }

        .ai-message-viewer .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: hsl(var(--primary));
          pointer-events: none;
        }

        .ai-message-viewer .ProseMirror .tableWrapper {
          overflow-x: auto;
          margin: 1rem 0;
        }

        .ai-message-viewer .ProseMirror .hljs {
          background: transparent;
          color: inherit;
        }

        .ai-message-viewer .ProseMirror .hljs-comment,
        .ai-message-viewer .ProseMirror .hljs-quote {
          color: #7ee787;
          font-style: italic;
        }

        .ai-message-viewer .ProseMirror .hljs-keyword,
        .ai-message-viewer .ProseMirror .hljs-selector-tag,
        .ai-message-viewer .ProseMirror .hljs-subst {
          color: #ff7b72;
        }

        .ai-message-viewer .ProseMirror .hljs-number,
        .ai-message-viewer .ProseMirror .hljs-literal,
        .ai-message-viewer .ProseMirror .hljs-variable,
        .ai-message-viewer .ProseMirror .hljs-template-variable,
        .ai-message-viewer .ProseMirror .hljs-tag .hljs-attr {
          color: #79c0ff;
        }

        .ai-message-viewer .ProseMirror .hljs-string,
        .ai-message-viewer .ProseMirror .hljs-doctag {
          color: #a5d6ff;
        }

        .ai-message-viewer .ProseMirror .hljs-title,
        .ai-message-viewer .ProseMirror .hljs-section,
        .ai-message-viewer .ProseMirror .hljs-selector-id {
          color: #d2a8ff;
          font-weight: bold;
        }

        .ai-message-viewer .ProseMirror .hljs-type,
        .ai-message-viewer .ProseMirror .hljs-class .hljs-title {
          color: #d2a8ff;
        }

        .ai-message-viewer .ProseMirror .hljs-tag,
        .ai-message-viewer .ProseMirror .hljs-name,
        .ai-message-viewer .ProseMirror .hljs-attribute {
          color: #7ee787;
          font-weight: normal;
        }

        .ai-message-viewer .ProseMirror .hljs-regexp,
        .ai-message-viewer .ProseMirror .hljs-link {
          color: #ffa657;
        }

        .ai-message-viewer .ProseMirror .hljs-symbol,
        .ai-message-viewer .ProseMirror .hljs-bullet {
          color: #79c0ff;
        }

        .ai-message-viewer .ProseMirror .hljs-built_in,
        .ai-message-viewer .ProseMirror .hljs-builtin-name {
          color: #ffa657;
        }

        .ai-message-viewer .ProseMirror .hljs-meta {
          color: #7ee787;
        }

        .ai-message-viewer .ProseMirror .hljs-deletion {
          background: #ffeef0;
        }

        .ai-message-viewer .ProseMirror .hljs-addition {
          background: #e6ffed;
        }

        .ai-message-viewer .ProseMirror .hljs-emphasis {
          font-style: italic;
        }

        .ai-message-viewer .ProseMirror .hljs-strong {
          font-weight: bold;
        }

        .ai-message-viewer .ProseMirror blockquote {
          border-left: 3px solid var(--primary);
          padding-left: 0.75rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          color: var(--muted-foreground);
          font-style: italic;
        }

        .ai-message-viewer .ProseMirror ul,
        .ai-message-viewer .ProseMirror ol {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }

        .ai-message-viewer .ProseMirror li {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }

        .ai-message-viewer .ProseMirror a {
          color: var(--primary);
          text-decoration: underline;
          text-decoration-color: var(--primary) / 30%;
        }

        .ai-message-viewer .ProseMirror a:hover {
          text-decoration-color: var(--primary);
        }

        .ai-message-viewer .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--border);
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .ai-message-viewer .ProseMirror strong {
          font-weight: 700;
        }

        .ai-message-viewer .ProseMirror em {
          font-style: italic;
        }

        .ai-message-viewer .ProseMirror s {
          text-decoration: line-through;
        }

        .ai-message-viewer .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  )
}
