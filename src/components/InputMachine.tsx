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
import { Image } from '@tiptap/extension-image'
import { common, createLowlight } from 'lowlight'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Loader2, Mic, MicOff, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { messagesApi } from "@/lib/api/messages"
import { markMessageSending } from "@/hooks/useSocket"
import { templatesApi } from "@/lib/api/templates"
import { aiApi } from "@/lib/api"
import { useSession } from "next-auth/react"
import { useRef } from "react"
import { Template } from "@/types/api"
import { SlashCommand } from "@/lib/editor/extensions/slash-command"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import { getAvatarUrl } from "@/lib/utils"

// Helper function to compact multiple newlines to single
function cleanMarkdown(markdown: string): string {
  if (!markdown) return markdown
  // Replace 2 or more consecutive newlines with single newline
  return markdown.replace(/\n{2,}/g, '\n')
}

interface InputMachineProps {
  onSuccess?: () => void
}

export function InputMachine({ onSuccess }: InputMachineProps) {
  const { data: session } = useSession()
  const { currentWorkspaceId } = useWorkspaceStore()
  const [isPosting, setIsPosting] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const mediaUploaderRef = useRef<MediaUploaderRef>(null)

  // 流式 AI 回复状态
  const [aiStreamingResponse, setAiStreamingResponse] = useState<string>("")
  const [isAiStreaming, setIsAiStreaming] = useState(false)

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
          chunks.push(event.data)
        }
      }

      recorder.onstop = async () => {

        // Create blob with the actual MIME type
        const audioBlob = new Blob(chunks, { type: actualMimeType })

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

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("ASR error response:", errorText)
        throw new Error(`ASR request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

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

  // Sanitize markdown to prevent TipTap mark conflicts
  const sanitizeMarkdown = (markdown: string): string => {
    // Remove bold from within code blocks (e.g., **`code`** -> `code`)
    let sanitized = markdown.replace(/\*\*`([^`]+)`\*\*/g, '`$1`')
    // Remove italic from within code blocks (e.g., *`code`* -> `code`)
    sanitized = sanitized.replace(/\*`([^`]+)`\*/g, '`$1`')
    // Remove bold/italic from within inline code (e.g., `**bold**` -> `bold`)
    sanitized = sanitized.replace(/`(\*\*[^*]+\*\*)`/g, '$1')
    sanitized = sanitized.replace(/`(\*[^*]+\*)`/g, '$1')
    return sanitized
  }

  // Handle AI command selection from button
  const handleAICommandFromButton = async (action: string) => {
    if (!editor || isProcessingAI) return

    // Get current text content
    const content = editor.getText().trim()
    if (!content) {
      // If no content, show a hint
      return
    }

    setIsProcessingAI(true)
    try {
      // Call streaming AI enhance API
      const response = await fetch('/api/ai/enhance/stream', {
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

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullResult = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue

            const eventMatch = line.match(/^event:\s*(.+)$/m)
            const dataMatch = line.match(/^data:\s*([\s\S]+)$/m)

            if (eventMatch?.[1] === 'content' && dataMatch?.[1]) {
              try {
                const data = JSON.parse(dataMatch[1])
                if (data.text) {
                  fullResult += data.text
                  // Update editor in real-time with current result
                  const sanitized = sanitizeMarkdown(fullResult)
                  try {
                    editor.commands.setContent(sanitized, {
                      contentType: 'markdown',
                      parseOptions: {
                        preserveWhitespace: 'full',
                      },
                    })
                  } catch (setContentError) {
                    console.warn('Failed to set markdown content:', setContentError)
                  }
                  setHasContent(true)
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Use clearContent for empty result to avoid Markdown parser issues
      if (!fullResult.trim()) {
        editor.commands.clearContent()
        setHasContent(false)
      }
    } catch (error) {
      console.error('AI enhance error:', error)
    } finally {
      setIsProcessingAI(false)
    }
  }

  // Handle template selection from "/" command
  const handleTemplateSelect = (template: Template, editor: any) => {
    if (!editor) return
    editor.commands.insertContent(template.content)
    setHasContent(true)
  }

  // Create lowlight instance for syntax highlighting
  const lowlight = createLowlight(common)

  const [aiCommands, setAICommands] = useState<any[]>([])

  // Fetch AI commands
  useEffect(() => {
    const fetchAICommands = async () => {
      try {
        const { aiCommandsApi } = await import("@/lib/api")
        const result = await aiCommandsApi.getCommands()
        if (result.data) {
          setAICommands(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch AI commands:", error)
      }
    }
    fetchAICommands()
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default code block, use CodeBlockLowlight instead
        link: false, // Disable automatic link conversion completely
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
        placeholder: "发生了什么？",
      }),
      SlashCommand.configure({
        onTemplateSelect: (template: Template, editor: any) => handleTemplateSelect(template, editor),
      }),
    ],
    immediatelyRender: false,
    content: '',
    editable: !isProcessingAI,
    coreExtensionOptions: {
      clipboardTextSerializer: {
        blockSeparator: '\n', // Use single newline for copy/paste
      },
    },
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
    if (!editor || isPosting || (!hasContent && uploadedMedia.length === 0)) return

    // ⚡ 立即标记：正在发送消息（在API调用之前）
    markMessageSending()

    let content = cleanMarkdown(editor.getMarkdown()) // Clean and store as Markdown
    const textContent = editor.getText() // Get plain text for @goldierill detection

    setIsPosting(true)
    try {
      // 解析用户输入中的标签（支持 #标签 格式）
      const tagRegex = /#([\u4e00-\u9fa5a-zA-Z0-9_]+)/g
      const tags: string[] = []

      // 从纯文本中提取标签
      const plainTextTags = [...textContent.matchAll(tagRegex)].map(m => m[1])

      // 去重并添加到标签数组
      plainTextTags.forEach(tag => {
        if (!tags.includes(tag)) {
          tags.push(tag)
        }
      })

      // 从内容中移除开头的标签（如果标签在内容开头）
      // 例如：#67\n自动测试 -> 自动测试
      if (tags.length > 0) {
        const lines = content.split('\n')
        let startIndex = 0

        // 检查前面几行是否只包含标签
        for (let i = 0; i < Math.min(3, lines.length); i++) {
          const line = lines[i].trim()
          // 如果这行只包含标签和空格，移除它
          if (/^#[\u4e00-\u9fa5a-zA-Z0-9_]+(\s+#[\u4e00-\u9fa5a-zA-Z0-9_]+)*\s*$/.test(line)) {
            startIndex = i + 1
          } else {
            break
          }
        }

        // 重建内容（移除标签行）
        if (startIndex > 0) {
          content = lines.slice(startIndex).join('\n').trim()
        }
      }

      // Create the message with media
      const result = await messagesApi.createMessage({
        content: content || "", // Allow empty content if media is present
        tags,
        media: uploadedMedia.map(m => ({ url: m.url, type: m.type })),
        workspaceId: currentWorkspaceId || undefined, // Pass current workspace ID
      })

      if (result.data) {
        // Detect AI mode from @mentions
        // @goldierill = direct OpenAI mode (current post context only)
        // @ragflow = RAGFlow mode (knowledge base retrieval)
        const hasGoldierillMention = /@goldierill/i.test(textContent)
        const hasRagflowMention = /@ragflow/i.test(textContent)

        // Only trigger AI if exactly one mention is present (or prioritize @ragflow if both)
        if (hasRagflowMention || hasGoldierillMention) {
          try {
            const mode = hasRagflowMention ? 'ragflow' : 'goldierill'
            // Remove the @mention from the question
            const mentionToRemove = hasRagflowMention ? /@ragflow/gi : /@goldierill/gi
            const question = textContent.replace(mentionToRemove, '').trim()

            // @ragflow: 使用非流式 API，立即发帖
            // @goldierill: 使用流式 API
            if (mode === 'ragflow') {
              // RAGFlow 模式：立即发帖，不等 AI 回复
              await aiApi.chat({
                messageId: result.data.id,
                content: question || '请回复这条消息',
                mode,
              })
            } else {
              // GoldieRill 模式：使用流式 API
              setIsAiStreaming(true)
              setAiStreamingResponse("")

              const response = await fetch('/api/ai/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messageId: result.data.id,
                  content: question || '请回复这条消息',
                  mode,
                }),
              })

              if (!response.ok) {
                throw new Error('AI stream request failed')
              }

              const reader = response.body?.getReader()
              const decoder = new TextDecoder()
              let buffer = ''

              if (reader) {
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break

                  buffer += decoder.decode(value, { stream: true })
                  const lines = buffer.split('\n\n')
                  buffer = lines.pop() || ''

                  for (const line of lines) {
                    if (!line.trim()) continue

                    const eventMatch = line.match(/^event:\s*(.+)$/m)
                    const dataMatch = line.match(/^data:\s*([\s\S]+)$/m)

                    if (eventMatch?.[1] === 'content' && dataMatch?.[1]) {
                      try {
                        const data = JSON.parse(dataMatch[1])
                        if (data.text) {
                          setAiStreamingResponse(prev => prev + data.text)
                        }
                      } catch (e) {
                        // Ignore parse errors
                      }
                    }
                  }
                }
              }
            }
          } catch (aiError) {
            console.error("Failed to get AI reply:", aiError)
          } finally {
            setIsAiStreaming(false)
            setTimeout(() => setAiStreamingResponse(""), 1000)
          }
        }

        // Clear editor and media
        editor.commands.clearContent()
        setHasContent(false)
        setUploadedMedia([])

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
    editor.commands.insertContent(template.content)
    setHasContent(true)
  }

  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex gap-4">
        {/* User avatar */}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={getAvatarUrl(session?.user?.name || null, session?.user?.image || null) || undefined} />
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

          {/* Media Previews and Uploader */}
          <MediaUploader
            ref={mediaUploaderRef}
            media={uploadedMedia}
            onMediaChange={setUploadedMedia}
            disabled={isPosting}
            onUploadingChange={setIsUploading}
          />

          {/* AI Streaming Response Display */}
          {isAiStreaming && aiStreamingResponse && (
            <div className="relative bg-muted/30 rounded-lg p-3 border border-border">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xs text-white font-bold shrink-0">
                  AI
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {aiStreamingResponse}
                  </p>
                  {isAiStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-1 align-middle" />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-3 -ml-2">
            {/* Left side: Action buttons */}
            <div className="flex-1 flex gap-1 text-primary">
              {/* Image Upload Button */}
              <button
                className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full flex items-center justify-center disabled:opacity-50"
                onClick={() => mediaUploaderRef.current?.triggerUpload()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                )}
              </button>

              {/* AI Commands Dropdown */}
              {aiCommands.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-[34px] w-[34px] text-primary hover:bg-primary/10 rounded-full flex items-center justify-center">
                      <Sparkles className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {aiCommands.map((command) => (
                      <DropdownMenuItem
                        key={command.id}
                        onClick={() => handleAICommandFromButton(command.action)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{command.label}</span>
                          <span className="text-xs text-muted-foreground">{command.description}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Microphone Button - Mobile only */}
              <button
                className="desktop:hidden h-[34px] w-[34px] hover:bg-primary/10 rounded-full flex items-center justify-center disabled:opacity-50 text-primary"
                disabled={isTranscribing}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Right side: Submit button */}
            <Button
              className="rounded-full px-5 font-bold bg-white hover:bg-gray-100 text-black shadow-sm transition-opacity border border-border"
              disabled={(!hasContent && uploadedMedia.length === 0) || isPosting || isUploading}
              onClick={handlePost}
            >
              {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : "发布"}
            </Button>
          </div>
        </div>
      </div>

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
