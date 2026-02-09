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
  Undo,
  Redo,
  FileCode
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
          levels: [1, 2, 3, 4],
        },
        codeBlock: false, // Disable default code block, use CodeBlockLowlight instead
        link: false, // Disable automatic link conversion - only convert explicit markdown links [text](url)
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
      `}</style>
    </div>
  )
}
