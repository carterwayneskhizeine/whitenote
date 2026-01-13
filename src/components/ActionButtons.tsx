"use client"

import { Button } from "@/components/ui/button"
import { Template } from "@/types/api"
import { Mic, MicOff, Loader2, Image as ImageIcon, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"
import { aiCommandsApi } from "@/lib/api"

export interface AICommandData {
  id: string
  label: string
  description: string
  action: string
}

interface ActionButtonsProps {
  templates?: Template[]
  onApplyTemplate?: (template: Template) => void
  onAICommandSelect?: (action: string) => void
  onSubmit?: () => void
  submitDisabled?: boolean
  isSubmitting?: boolean
  submitText?: string
  hasContent?: boolean
  hasMedia?: boolean
  showSubmitButton?: boolean
  showMicButton?: boolean
  isRecording?: boolean
  isTranscribing?: boolean
  onStartRecording?: () => void
  onStopRecording?: () => void
  onImageUpload?: () => void
  imageUploading?: boolean
  size?: "sm" | "md"
}

export function ActionButtons({
  templates = [],
  onApplyTemplate,
  onAICommandSelect,
  onSubmit,
  submitDisabled = false,
  isSubmitting = false,
  submitText = "发布",
  hasContent = false,
  hasMedia = false,
  showSubmitButton = true,
  showMicButton = false,
  isRecording = false,
  isTranscribing = false,
  onStartRecording,
  onStopRecording,
  onImageUpload,
  imageUploading = false,
  size = "md",
}: ActionButtonsProps) {
  const buttonSize = size === "sm" ? "h-8 w-8" : "h-[34px] w-[34px]"
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5"

  const [aiCommands, setAICommands] = useState<AICommandData[]>([])

  useEffect(() => {
    const loadCommands = async () => {
      try {
        const result = await aiCommandsApi.getCommands()
        if (result.data) {
          setAICommands(result.data)
        }
      } catch (error) {
        console.error('Failed to load AI commands:', error)
      }
    }
    loadCommands()
  }, [])

  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-1 text-primary">
        {/* Image Upload Button */}
        {onImageUpload && (
          <Button
            variant="ghost"
            size="icon"
            className={`${buttonSize} text-primary hover:bg-primary/10 rounded-full`}
            onClick={onImageUpload}
            disabled={imageUploading}
          >
            {imageUploading ? (
              <Loader2 className={`${iconSize} animate-spin`} />
            ) : (
              <ImageIcon className={iconSize} />
            )}
          </Button>
        )}

        {/* AI Commands Dropdown */}
        {aiCommands.length > 0 && onAICommandSelect && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={`${buttonSize} text-primary hover:bg-primary/10 rounded-full`}>
                <Sparkles className={iconSize} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {aiCommands.map((command) => (
                <DropdownMenuItem
                  key={command.id}
                  onClick={() => onAICommandSelect(command.action)}
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
        {showMicButton && onStartRecording && onStopRecording && (
          <Button
            variant="ghost"
            size="icon"
            className={`desktop:hidden ${buttonSize} hover:bg-primary/10 rounded-full ${
              isRecording ? "bg-red-500 text-white hover:bg-red-600" : "text-primary"
            }`}
            disabled={isTranscribing}
            onClick={isRecording ? onStopRecording : onStartRecording}
          >
            {isRecording ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Word Count Circle Placeholder */}
        {(hasContent || hasMedia) && (
          <div className="w-6 h-6 rounded-full border-2 border-primary/30 flex items-center justify-center">
            <div className="w-3 h-3 text-[10px] text-primary/50 text-center leading-none">+</div>
          </div>
        )}

        {/* Submit Button */}
        {showSubmitButton && onSubmit && (
          <Button
            className="rounded-full px-5 font-bold h-9 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            disabled={submitDisabled || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitText}
          </Button>
        )}
      </div>
    </div>
  )
}
