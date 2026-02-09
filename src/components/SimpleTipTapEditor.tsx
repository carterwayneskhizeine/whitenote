"use client"

import { useEffect } from "react"
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
import { SlashCommand } from '@/lib/editor/extensions/slash-command'
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
        // Remove link: false - in TipTap 3.19, this is handled differently
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
          gfm: true, // GitHub Flavored Markdown (includes tables)
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

        /* Tables */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1rem 0;
          overflow: hidden;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
        }

        .ProseMirror table td,
        .ProseMirror table th {
          min-width: 1em;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          background-color: hsl(var(--background));
        }

        .ProseMirror table th {
          font-weight: 600;
          text-align: left;
          background-color: hsl(var(--muted) / 0.3);
        }

        .ProseMirror table .selectedCell:after {
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

        .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: hsl(var(--primary));
          pointer-events: none;
        }

        /* Table wrapper for overflow */
        .ProseMirror .tableWrapper {
          overflow-x: auto;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  )
}
