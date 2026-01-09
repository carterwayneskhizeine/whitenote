"use client"

import { useState, useEffect } from "react"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Image as ImageIcon, Smile, List, Calendar, MapPin, Loader2, FileText, Mic, MicOff } from "lucide-react"
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
import { SlashCommand } from "@/lib/editor/extensions/slash-command"

interface InputMachineProps {
  onSuccess?: () => void
}

export function InputMachine({ onSuccess }: InputMachineProps) {
  const { data: session } = useSession()
  const [isPosting, setIsPosting] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

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

  // Fetch ASR config
  const [asrConfig, setAsrConfig] = useState<{ apiKey: string; apiUrl: string } | null>(null)
  useEffect(() => {
    const fetchAsrConfig = async () => {
      try {
        const { configApi } = await import("@/lib/api/config")
        const result = await configApi.getConfig()
        if (result.data) {
          // Get session storage key (similar to AIConfigForm)
          const sessionAsrKey = sessionStorage.getItem('asr_api_key')

          // Use session key if available, otherwise use the value from backend
          const apiKey = sessionAsrKey || (result.data.asrApiKey !== "***" ? result.data.asrApiKey : "")

          setAsrConfig({
            apiKey,
            apiUrl: result.data.asrApiUrl || "https://api.siliconflow.cn/v1/audio/transcriptions",
          })
        }
      } catch (error) {
        console.error("Failed to fetch ASR config:", error)
      }
    }
    fetchAsrConfig()
  }, [])

  // Listen for storage changes (when user saves config in settings)
  useEffect(() => {
    const handleStorageChange = () => {
      const sessionAsrKey = sessionStorage.getItem('asr_api_key')
      if (asrConfig && sessionAsrKey) {
        setAsrConfig(prev => prev ? { ...prev, apiKey: sessionAsrKey } : null)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [asrConfig])

  // Start recording
  const startRecording = async () => {
    // Get the latest API key from sessionStorage
    const sessionAsrKey = sessionStorage.getItem('asr_api_key')
    const apiKey = sessionAsrKey || asrConfig?.apiKey

    // Check if API key is configured (not empty, not "***")
    if (!apiKey || apiKey === "" || apiKey === "***") {
      alert("请先在设置中配置 ASR API Key")
      return
    }

    // Update asrConfig with the session key
    if (sessionAsrKey && asrConfig) {
      setAsrConfig({ ...asrConfig, apiKey: sessionAsrKey })
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Determine supported MIME types (prefer mp3/mpeg, fallback to webm)
      const mimeType = MediaRecorder.isTypeSupported('audio/mpeg')
        ? 'audio/mpeg'
        : MediaRecorder.isTypeSupported('audio/mp3')
        ? 'audio/mp3'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const options = mimeType ? { mimeType } : undefined
      const recorder = new MediaRecorder(stream, options)

      // Store the actual MIME type being used
      const actualMimeType = recorder.mimeType || mimeType

      // Use local array to collect chunks (more reliable than state)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log("Received audio chunk:", event.data.size, "bytes")
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        console.log("Recorder stopped, total chunks:", chunks.length)

        // Create blob with the actual MIME type
        const audioBlob = new Blob(chunks, { type: actualMimeType })

        console.log("Created audio blob:", {
          size: audioBlob.size,
          type: audioBlob.type,
        })

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop())

        // Transcribe with format info
        await transcribeAudio(audioBlob, actualMimeType)
      }

      recorder.start(1000) // Request data every second
      setMediaRecorder(recorder)
      setIsRecording(true)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      alert("无法访问麦克风，请检查权限设置")
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  // Transcribe audio
  const transcribeAudio = async (audioBlob: Blob, mimeType?: string) => {
    // Get the latest API key from sessionStorage
    const sessionAsrKey = sessionStorage.getItem('asr_api_key')
    const apiKey = sessionAsrKey || asrConfig?.apiKey
    const apiUrl = asrConfig?.apiUrl || "https://api.siliconflow.cn/v1/audio/transcriptions"

    if (!apiKey || apiKey === "" || apiKey === "***") {
      alert("请先在设置中配置 ASR API Key")
      return
    }

    setIsTranscribing(true)
    try {
      // Determine file extension based on MIME type
      const actualMimeType = mimeType || audioBlob.type
      let fileExtension = "webm"

      if (actualMimeType.includes("mpeg") || actualMimeType.includes("mp3")) {
        fileExtension = "mp3"
      } else if (actualMimeType.includes("wav")) {
        fileExtension = "wav"
      } else if (actualMimeType.includes("opus")) {
        fileExtension = "opus"
      } else if (actualMimeType.includes("webm")) {
        fileExtension = "webm"
      }

      // Convert to File object with proper MIME type and extension
      const fileName = `audio.${fileExtension}`
      const file = new File([audioBlob], fileName, { type: actualMimeType })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("model", "TeleAI/TeleSpeechASR")

      console.log("Sending ASR request:", {
        url: apiUrl,
        fileSize: audioBlob.size,
        fileName: file.name,
        mimeType: file.type,
      })

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      })

      console.log("ASR response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("ASR error response:", errorText)
        throw new Error(`ASR request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("ASR response data:", data)

      if (data.text && editor) {
        // Insert text at cursor position
        const currentContent = editor.getMarkdown()
        const newContent = currentContent + (currentContent ? "\n" : "") + data.text
        editor.commands.setContent(newContent, {
          contentType: "markdown",
          parseOptions: {
            preserveWhitespace: "full",
          },
        })
        setHasContent(true)
      } else {
        console.warn("No text in ASR response:", data)
        alert("未能识别到语音内容，请重试")
      }
    } catch (error) {
      console.error("Transcription error:", error)
      alert(`语音转文字失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setIsTranscribing(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop()
      }
    }
  }, [mediaRecorder])

  // Handle AI command selection
  const handleAICommand = async (action: string, editor: any) => {
    if (!editor || isProcessingAI) return

    // Get current text content
    const content = editor.getText().trim()
    if (!content) {
      // If no content, show a hint
      return
    }

    setIsProcessingAI(true)
    try {
      // Call AI enhance API
      const response = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          content,
        }),
      })

      if (!response.ok) {
        throw new Error('AI request failed')
      }

      const data = await response.json()

      if (data.data?.result) {
        // Replace editor content with AI result as Markdown
        editor.commands.setContent(data.data.result, {
          contentType: 'markdown',
          parseOptions: {
            preserveWhitespace: 'full',
          },
        })
        setHasContent(true)
      }
    } catch (error) {
      console.error('AI enhance error:', error)
      // You might want to show a toast notification here
    } finally {
      setIsProcessingAI(false)
    }
  }

  // Create lowlight instance for syntax highlighting
  const lowlight = createLowlight(common)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
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
          gfm: true,
          breaks: true,
        },
      }),
      Placeholder.configure({
        placeholder: "发生了什么？",
      }),
      SlashCommand.configure({
        onCommandSelect: (action: string, editor: any) => handleAICommand(action, editor),
      }),
    ],
    immediatelyRender: false,
    content: '',
    editable: !isProcessingAI,
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert focus:outline-none min-h-[50px] w-full bg-transparent text-lg leading-6 placeholder:text-muted-foreground/60 whitespace-normal break-words overflow-wrap-anywhere ${isProcessingAI ? 'opacity-50 cursor-wait' : ''}`,
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

  // Update editor editable state when isProcessingAI changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isProcessingAI)
    }
  }, [isProcessingAI, editor])

  // Auto-resize is handled by TipTap/HTML contenteditable nature usually, but min-h helps.

  const handlePost = async () => {
    if (!editor || isPosting || !hasContent) return

    const content = editor.getMarkdown() // Store as Markdown instead of HTML
    const textContent = editor.getText() // Get plain text for @goldierill detection

    setIsPosting(true)
    try {
      // Create the message
      const result = await messagesApi.createMessage({
        content,
        tags: [],
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
          } catch (aiError) {
            console.error("Failed to get AI reply:", aiError)
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
    setHasContent(true)
  }

  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex gap-4">
        {/* User avatar */}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={session?.user?.image || undefined} className="opacity-0" />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {getInitials(session?.user?.name)}
          </AvatarFallback>
        </Avatar>

        {/* Input area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="relative py-2 min-w-0">
            <EditorContent editor={editor} className="w-full max-w-full" />

            {/* AI Processing Overlay */}
            {isProcessingAI && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-md z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">AI 正在处理...</span>
                </div>
              </div>
            )}

            {/* Transcribing Overlay */}
            {isTranscribing && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-md z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">正在转文字...</span>
                </div>
              </div>
            )}

            {/* Recording Indicator */}
            {isRecording && (
              <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium z-10 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full" />
                录音中...
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 -ml-2">
            <div className="flex gap-0 text-primary">
              <Button variant="ghost" size="icon" className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full">
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full">
                <span className="font-bold text-xs border border-current rounded px-0.5">GIF</span>
              </Button>

              {/* Templates Dropdown mapped to List icon */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full">
                    <List className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {templates.length > 0 ? templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{template.name}</span>
                      </div>
                    </DropdownMenuItem>
                  )) : (
                    <div className="p-2 text-sm text-muted-foreground">暂无模板</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="icon" className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full">
                <Smile className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full">
                <Calendar className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full">
                <MapPin className="h-5 w-5" />
              </Button>

              {/* Microphone Button - Mobile only */}
              <Button
                variant="ghost"
                size="icon"
                className={`desktop:hidden h-[34px] w-[34px] hover:bg-primary/10 rounded-full ${
                  isRecording ? "bg-red-500 text-white hover:bg-red-600" : "text-primary"
                }`}
                disabled={isTranscribing}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* Word Count Circle Placeholder */}
              {hasContent && (
                <div className="w-6 h-6 rounded-full border-2 border-primary/30 flex items-center justify-center">
                  <div className="w-3 h-3 text-[10px] text-primary/50 text-center leading-none">+</div>
                </div>
              )}

              <Button
                className="rounded-full px-5 font-bold bg-white hover:bg-gray-100 text-black shadow-sm transition-opacity border border-border"
                disabled={!hasContent || isPosting}
                onClick={handlePost}
              >
                {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : "发布"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
