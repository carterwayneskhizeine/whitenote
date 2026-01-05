"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from "@/components/ui/button"
import { Image as ImageIcon, Smile, Paperclip } from "lucide-react"

export function InputMachine() {
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
  })

  return (
    <div className="border-b px-4 py-4 flex gap-4">
      <div className="flex-1 flex flex-col gap-4">
        <EditorContent editor={editor} className="w-full" />

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex gap-1 text-primary">
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
          <Button className="rounded-full px-5 font-bold bg-primary hover:bg-primary/90 text-white shadow-sm" disabled={!editor?.getText()}>
            Post
          </Button>
        </div>
      </div>
    </div>
  )
}
