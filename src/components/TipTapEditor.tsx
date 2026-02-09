"use client"

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Image } from '@tiptap/extension-image'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { common, createLowlight } from 'lowlight'
import { Button } from "@/components/ui/button"
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Undo,
  Redo,
  FileCode,
  Table as TableIcon,
  Minus,
  CheckSquare,
  Pilcrow,
  Highlighter,
  RemoveFormatting
} from "lucide-react"
import { cn } from "@/lib/utils"

// Helper function to compact multiple newlines to single
function cleanMarkdown(markdown: string): string {
  if (!markdown) return markdown
  // Replace 2 or more consecutive newlines with single newline
  return markdown.replace(/\n{2,}/g, '\n')
}

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  editorContentClassName?: string
}

export function TipTapEditor({
  content,
  onChange,
  placeholder = "输入内容...",
  className,
  editorContentClassName
}: TipTapEditorProps) {
  const [isFocused, setIsFocused] = React.useState(false)

  // Create lowlight instance for syntax highlighting
  const lowlight = createLowlight(common)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: false, // Disable default code block, use CodeBlockLowlight instead
        // Remove link: false - in TipTap 3.19, this is handled differently
      }),
      TextStyle,
      Highlight.configure({
        multicolor: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
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
      Placeholder.configure({
        placeholder,
      }),
    ],
    // Set immediatelyRender to false to avoid hydration mismatch
    immediatelyRender: false,
    content,
    contentType: 'markdown', // Parse content as Markdown
    coreExtensionOptions: {
      clipboardTextSerializer: {
        blockSeparator: '\n', // Use single newline for copy/paste
      },
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert focus:outline-none min-h-[min(300px,100%)] h-full w-full',
        style: 'max-width: none !important; width: 100%;',
      },
    },
    onUpdate: ({ editor }) => {
      // Clean excessive newlines before calling onChange
      onChange(cleanMarkdown(editor.getMarkdown()))
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  })

  // Ensure editor content is updated if external content changes markedly (optional, usually handled by editor state, but good for reset)
  React.useEffect(() => {
    if (editor && content !== editor.getMarkdown()) {
      // We keep the internal state in sync if needed, but avoid loops
      // editor.commands.setContent(content)
    }
  }, [content, editor])


  if (!editor) {
    return null
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
    className: btnClassName
  }: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title: string
    className?: string
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50",
        isActive && "bg-muted text-foreground",
        btnClassName
      )}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  )

  const Separator = () => <div className="w-px h-5 bg-border/50 mx-1 self-center hidden sm:block" />

  return (
    <div className={cn("flex flex-col bg-background h-full w-full", className)}>
      {/* Professional Sticky Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background/95 backdrop-blur px-4 py-3 sticky top-0 z-50 shadow-sm transition-all duration-200">

        {/* History Group */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="撤销 (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="重做 (Ctrl+Shift+Z)"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        {/* Headings Group */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="一级标题"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="二级标题"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="三级标题"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            isActive={editor.isActive('heading', { level: 4 })}
            title="四级标题"
          >
            <Heading4 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
            isActive={editor.isActive('heading', { level: 5 })}
            title="五级标题"
          >
            <Heading5 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
            isActive={editor.isActive('heading', { level: 6 })}
            title="六级标题"
          >
            <Heading6 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setParagraph().run()}
            isActive={editor.isActive('paragraph')}
            title="正文"
          >
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        {/* Formatting Group */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="粗体 (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="斜体 (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="删除线"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title="行内代码"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="代码块"
          >
            <FileCode className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            title="高亮"
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
            title="清除格式"
          >
            <RemoveFormatting className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="引用"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        {/* Lists Group */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="无序列表"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="有序列表"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            isActive={editor.isActive('taskList')}
            title="任务列表"
          >
            <CheckSquare className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        {/* Insert Group */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="插入表格"
          >
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="分割线"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content Area */}
      {/* We use a container that centers the content similar to Notion/Medium for readability while keeping full width availability */}
      <div
        className={cn("flex-1 bg-background cursor-text overflow-hidden", editorContentClassName)}
        onClick={() => {
          if (!editor.isFocused) {
            editor.commands.focus()
          }
        }}
      >
        <EditorContent editor={editor} className="h-full outline-none custom-scrollbar overflow-y-auto" />
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.8);
        }
        .ProseMirror {
          min-height: 100%;
          height: 100%;
          max-height: 100%;
          outline: none;
          overflow-y: auto !important;
          padding-right: 4px;
        }
        /* Remove default paragraph margins to prevent extra spacing */
        .ProseMirror p {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        /* Enhance blockquote styling */
        .ProseMirror blockquote {
          border-left-color: var(--primary);
          background: var(--muted);
          padding: 0.5rem 1rem;
          border-radius: 0.2rem;
        }
        /* Custom placeholder styling */
        .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--muted-foreground);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        /* Images */
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          display: block;
          margin: 0.5rem 0;
        }

        /* Task List */
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .ProseMirror ul[data-type="taskList"] li > label {
          margin-top: 0.25rem;
          flex-shrink: 0;
        }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
          width: 1rem;
          height: 1rem;
          cursor: pointer;
        }
        .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1;
        }

        /* Highlight */
        .ProseMirror mark {
          background-color: rgba(255, 255, 0, 0.4);
          padding: 0.1rem 0.2rem;
          border-radius: 0.2rem;
        }

        /* Horizontal Rule */
        .ProseMirror hr {
          border: none;
          border-top: 2px solid var(--border);
          margin: 1rem 0;
        }

        /* Table */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .ProseMirror table td,
        .ProseMirror table th {
          min-width: 1em;
          border: 1px solid var(--border);
          padding: 0.25rem 0.5rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror table th {
          font-weight: bold;
          text-align: left;
          background-color: var(--muted);
        }
        .ProseMirror table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
        .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #adf;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
