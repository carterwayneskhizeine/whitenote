"use client"

import { useState, useEffect } from "react"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Image as ImageIcon, Smile, Paperclip, Loader2, FileText } from "lucide-react"
import { messagesApi } from "@/lib/api/messages"
import { templatesApi } from "@/lib/api/templates"
import { aiApi } from "@/lib/api"
import { useSession } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Template } from "@/types/api"

interface InputMachineProps {
  onSuccess?: () => void
}

export function InputMachine({ onSuccess }: InputMachineProps) {
  const { data: session } = useSession()
  const [isPosting, setIsPosting] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const result = await templatesApi.getTemplates()
        if (result.data) {
          setTemplates(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error)
      }
    }
    fetchTemplates()
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "What's on your mind? Type '/' for commands...",
      }),
    ],
    immediatelyRender: false,
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[100px] w-full bg-transparent',
      },
    },
    onUpdate: ({ editor }) => {
      // Check if editor has content
      const text = editor.getText()
      const html = editor.getHTML()
      const isEmpty = text.trim().length === 0 && html === '<p></p>'
      setHasContent(!isEmpty)
    },
  })

  const handlePost = async () => {
    if (!editor || isPosting || !hasContent) return

    const content = editor.getHTML()
    const textContent = editor.getText() // Get plain text for @goldierill detection

    setIsPosting(true)
    try {
      // Create the message
      const result = await messagesApi.createMessage({
        content,
        tags: [], // TODO: Add tag support
      })

      if (result.data) {
        // Check if message contains @goldierill and trigger AI reply
        if (textContent.includes('@goldierill')) {
          try {
            const question = textContent.replace('@goldierill', '').trim()
            await aiApi.chat({
              messageId: result.data.id,
              content: question || '请回复这条消息',
            })
            // AI comment is automatically created by backend
          } catch (aiError) {
            console.error("Failed to get AI reply:", aiError)
            // Don't fail the post if AI fails
          }
        }

        // Clear editor
        editor.commands.clearContent()
        setHasContent(false)

        // Call success callback
        onSuccess?.()
      }
    } catch (error) {
      console.error("Failed to create message:", error)
      // TODO: Show error toast
    } finally {
      setIsPosting(false)
    }
  }

  // Get user initials
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Apply template
  const applyTemplate = (template: Template) => {
    if (!editor) return
    editor.commands.setContent(template.content)
    setShowTemplates(false)
    setHasContent(true)
  }

  return (
    <div className="border-b px-4 py-4">
      <div className="flex gap-3">
        {/* User avatar */}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={session?.user?.image || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {getInitials(session?.user?.name)}
          </AvatarFallback>
        </Avatar>

        {/* Input area */}
        <div className="flex-1 flex flex-col gap-4">
          <EditorContent editor={editor} className="w-full" />

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex gap-1 text-primary">
              {/* Templates */}
              {templates.length > 0 && (
                <DropdownMenu open={showTemplates} onOpenChange={setShowTemplates}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full">
                      <FileText className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {templates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{template.name}</span>
                          {template.description && (
                            <span className="text-xs text-muted-foreground">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full">
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full">
                <Smile className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full">
                <Paperclip className="h-5 w-5" />
              </Button>
            </div>
            <Button
              className="rounded-full px-5 font-bold bg-primary hover:bg-primary/90 text-white shadow-sm"
              disabled={!hasContent || isPosting}
              onClick={handlePost}
            >
              {isPosting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
