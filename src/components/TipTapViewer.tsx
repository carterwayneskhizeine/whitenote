"use client"

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { cn } from "@/lib/utils"

interface TipTapViewerProps {
  content: string
  className?: string
}

/**
 * Read-only TipTap viewer that supports Markdown content rendering.
 * Use this to display message content with proper Markdown formatting.
 */
export function TipTapViewer({ content, className }: TipTapViewerProps) {
  // Create lowlight instance for syntax highlighting
  const lowlight = createLowlight(common)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: false, // Disable default code block, use CodeBlockLowlight instead
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
          gfm: true, // GitHub Flavored Markdown
          breaks: true, // Convert \n to <br>
        },
      }),
    ],
    content,
    contentType: 'markdown', // Parse content as Markdown
    immediatelyRender: false,
    editable: false, // Make it read-only
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none',
      },
    },
  })

  // Add copy buttons to code blocks after editor is ready
  useEffect(() => {
    if (!editor) return

    const addCopyButtons = () => {
      const codeBlocks = editor.view.dom.querySelectorAll('pre')
      codeBlocks.forEach((pre: Element) => {
        // Skip if already has copy button
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

    // Delay to ensure editor is fully rendered
    const timer = setTimeout(() => {
      addCopyButtons()
    }, 100)

    // Watch for content changes
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

  return (
    <div className={cn("tipTap-viewer", className)}>
      <EditorContent editor={editor} />
      <style jsx global>{`
        .tipTap-viewer .ProseMirror {
          outline: none;
          pointer-events: none; /* Ensure it's truly read-only */
        }

        /* Headings */
        .tipTap-viewer .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .tipTap-viewer .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.875rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .tipTap-viewer .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }

        .tipTap-viewer .ProseMirror h4,
        .tipTap-viewer .ProseMirror h5,
        .tipTap-viewer .ProseMirror h6 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }

        /* Paragraphs */
        .tipTap-viewer .ProseMirror p {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }

        /* Code blocks */
        .tipTap-viewer .ProseMirror pre {
          background-color: #1e1e1e;
          border-radius: 0.5rem;
          padding: 0.875rem 1rem;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
          overflow-x: auto;
          border: 1px solid #333333;
          position: relative;
          pointer-events: auto;
        }

        .tipTap-viewer .ProseMirror pre code {
          background-color: transparent;
          padding: 0;
          font-size: 1.0em;
          color: inherit;
          font-family: 'JetBrainsMono', 'Fira Code', Consolas, Monaco, monospace;
        }

        .tipTap-viewer .ProseMirror code {
          background-color: hsl(var(--muted) / 0.5);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: 'JetBrainsMono', 'Fira Code', Consolas, Monaco, monospace;
        }

        /* Code block copy button */
        .tipTap-viewer .ProseMirror pre .code-copy-btn {
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

        /* Light mode (default) - black button */
        .tipTap-viewer .ProseMirror pre .code-copy-btn,
        :not(.dark) .tipTap-viewer .ProseMirror pre .code-copy-btn {
          color: #000000;
        }

        /* Dark mode - white button */
        .dark .tipTap-viewer .ProseMirror pre .code-copy-btn {
          color: #ffffff;
        }

        .tipTap-viewer .ProseMirror pre:hover .code-copy-btn {
          opacity: 1;
        }

        .tipTap-viewer .ProseMirror pre .code-copy-btn.copied {
          color: #22c55e !important;
          opacity: 1 !important;
        }

        /* Tables */
        .tipTap-viewer .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1rem 0;
          overflow: hidden;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
        }

        .tipTap-viewer .ProseMirror table td,
        .tipTap-viewer .ProseMirror table th {
          min-width: 1em;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          background-color: hsl(var(--background));
        }

        .tipTap-viewer .ProseMirror table th {
          font-weight: 600;
          text-align: left;
          background-color: hsl(var(--muted) / 0.3);
        }

        .tipTap-viewer .ProseMirror table .selectedCell:after {
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

        .tipTap-viewer .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: hsl(var(--primary));
          pointer-events: none;
        }

        /* Table wrapper for overflow */
        .tipTap-viewer .ProseMirror .tableWrapper {
          overflow-x: auto;
          margin: 1rem 0;
        }

        /* Syntax highlighting colors */
        .tipTap-viewer .ProseMirror .hljs {
          background: transparent;
          color: inherit;
        }

        .tipTap-viewer .ProseMirror .hljs-comment,
        .tipTap-viewer .ProseMirror .hljs-quote {
          color: hsl(var(--muted-foreground));
          font-style: italic;
        }

        .tipTap-viewer .ProseMirror .hljs-keyword,
        .tipTap-viewer .ProseMirror .hljs-selector-tag,
        .tipTap-viewer .ProseMirror .hljs-subst {
          color: #d73a49;
        }

        .tipTap-viewer .ProseMirror .hljs-number,
        .tipTap-viewer .ProseMirror .hljs-literal,
        .tipTap-viewer .ProseMirror .hljs-variable,
        .tipTap-viewer .ProseMirror .hljs-template-variable,
        .tipTap-viewer .ProseMirror .hljs-tag .hljs-attr {
          color: #005cc5;
        }

        .tipTap-viewer .ProseMirror .hljs-string,
        .tipTap-viewer .ProseMirror .hljs-doctag {
          color: #032f62;
        }

        .tipTap-viewer .ProseMirror .hljs-title,
        .tipTap-viewer .ProseMirror .hljs-section,
        .tipTap-viewer .ProseMirror .hljs-selector-id {
          color: #6f42c1;
          font-weight: bold;
        }

        .tipTap-viewer .ProseMirror .hljs-type,
        .tipTap-viewer .ProseMirror .hljs-class .hljs-title {
          color: #6f42c1;
        }

        .tipTap-viewer .ProseMirror .hljs-tag,
        .tipTap-viewer .ProseMirror .hljs-name,
        .tipTap-viewer .ProseMirror .hljs-attribute {
          color: #22863a;
          font-weight: normal;
        }

        .tipTap-viewer .ProseMirror .hljs-regexp,
        .tipTap-viewer .ProseMirror .hljs-link {
          color: #e36209;
        }

        .tipTap-viewer .ProseMirror .hljs-symbol,
        .tipTap-viewer .ProseMirror .hljs-bullet {
          color: #005cc5;
        }

        .tipTap-viewer .ProseMirror .hljs-built_in,
        .tipTap-viewer .ProseMirror .hljs-builtin-name {
          color: #005cc5;
        }

        .tipTap-viewer .ProseMirror .hljs-meta {
          color: #22863a;
        }

        .tipTap-viewer .ProseMirror .hljs-deletion {
          background: #ffeef0;
        }

        .tipTap-viewer .ProseMirror .hljs-addition {
          background: #e6ffed;
        }

        .tipTap-viewer .ProseMirror .hljs-emphasis {
          font-style: italic;
        }

        .tipTap-viewer .ProseMirror .hljs-strong {
          font-weight: bold;
        }

        /* Blockquotes */
        .tipTap-viewer .ProseMirror blockquote {
          border-left: 3px solid var(--primary);
          padding-left: 0.75rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          color: var(--muted-foreground);
          font-style: italic;
        }

        /* Lists */
        .tipTap-viewer .ProseMirror ul,
        .tipTap-viewer .ProseMirror ol {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }

        .tipTap-viewer .ProseMirror li {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }

        /* Links */
        .tipTap-viewer .ProseMirror a {
          color: var(--primary);
          text-decoration: underline;
          text-decoration-color: var(--primary) / 30%;
        }

        .tipTap-viewer .ProseMirror a:hover {
          text-decoration-color: var(--primary);
        }

        /* Horizontal rules */
        .tipTap-viewer .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--border);
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        /* Strong and emphasis */
        .tipTap-viewer .ProseMirror strong {
          font-weight: 700;
        }

        .tipTap-viewer .ProseMirror em {
          font-style: italic;
        }

        /* Strikethrough */
        .tipTap-viewer .ProseMirror s {
          text-decoration: line-through;
        }
      `}</style>
    </div>
  )
}
