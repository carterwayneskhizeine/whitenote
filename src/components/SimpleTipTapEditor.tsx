"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Image } from '@tiptap/extension-image'
import { common, createLowlight } from 'lowlight'
import { SlashCommand } from '@/lib/editor/extensions/slash-command'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Template } from '@/types/api'

interface SimpleTipTapEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  isProcessingAI?: boolean
  className?: string
  onTemplateSelect?: (template: Template, editor: any) => void
  onAICommandSelect?: (action: string, editor: any) => void
  minHeight?: string
}

export function SimpleTipTapEditor({
  value,
  onChange,
  placeholder = "发生了什么？",
  disabled = false,
  isProcessingAI = false,
  className,
  onTemplateSelect,
  onAICommandSelect,
  minHeight = "50px",
}: SimpleTipTapEditorProps) {
  // Create lowlight instance for syntax highlighting
  const lowlight = createLowlight(common)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
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
      SlashCommand.configure({
        onTemplateSelect: (template: any, editor: any) => {
          if (onTemplateSelect) {
            onTemplateSelect(template, editor)
          }
        },
      }),
    ],
    immediatelyRender: false,
    content: value,
    editable: !disabled && !isProcessingAI,
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert focus:outline-none w-full bg-transparent text-lg leading-6 placeholder:text-muted-foreground/60 whitespace-normal break-words overflow-wrap-anywhere ${isProcessingAI ? 'opacity-50 cursor-wait' : ''}`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown())
    },
  })

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getMarkdown()) {
      // Avoid setting empty content via Markdown parser, use clearContent instead
      if (!value || value.trim() === '') {
        editor.commands.clearContent()
      } else {
        editor.commands.setContent(value, {
          contentType: 'markdown',
          parseOptions: {
            preserveWhitespace: 'full',
          },
        })
      }
    }
  }, [value, editor])

  // Update editor editable state when disabled/isProcessingAI changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled && !isProcessingAI)
    }
  }, [disabled, isProcessingAI, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={cn("relative w-full", className)}>
      <EditorContent editor={editor} className="w-full" />

      {/* AI Processing Overlay */}
      {isProcessingAI && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-md z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">AI 正在处理...</span>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Remove default paragraph margins to prevent extra spacing */
        .ProseMirror p {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
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
