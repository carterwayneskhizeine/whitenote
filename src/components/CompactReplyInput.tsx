"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MediaUploader, MediaItem, MediaUploaderRef } from "@/components/MediaUploader"
import { Template } from "@/types/api"
import { cn } from "@/lib/utils"

export interface CompactReplyInputProps {
  // 输入内容
  value: string
  onChange: (value: string) => void

  // 媒体
  media: MediaItem[]
  onMediaChange: (media: MediaItem[] | ((prevMedia: MediaItem[]) => MediaItem[])) => void
  isUploading: boolean
  onUploadingChange: (uploading: boolean) => void

  // 状态
  posting: boolean
  focused: boolean
  onFocusedChange: (focused: boolean) => void

  // 模板
  templates: Template[]
  onApplyTemplate: (template: Template) => void

  // 提交
  onSubmit: () => void
  placeholder?: string
  submitLabel?: string

  // 样式
  className?: string
}

export function CompactReplyInput({
  value,
  onChange,
  media,
  onMediaChange,
  isUploading,
  onUploadingChange,
  posting,
  focused,
  onFocusedChange,
  templates,
  onApplyTemplate,
  onSubmit,
  placeholder = "发布你的回复",
  submitLabel = "回复",
  className,
}: CompactReplyInputProps) {
  const { data: session } = useSession()
  const mediaUploaderRef = useRef<MediaUploaderRef>(null)

  const canSubmit = (value.trim() || media.length > 0) && !posting

  return (
    <div className={cn("px-4 pb-4 border-b", className)}>
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={session?.user?.image || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {session?.user?.name?.slice(0, 2) || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Compact mode: textarea and button on same line */}
          {!focused && !value.trim() && media.length === 0 ? (
            <div className="flex items-center gap-3">
              <textarea
                placeholder={placeholder}
                className="flex-1 bg-transparent border-none focus:outline-none text-lg resize-none h-9 py-1 placeholder:text-muted-foreground"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => onFocusedChange(true)}
                disabled={posting}
                rows={1}
              />
              <Button
                className="rounded-full px-5 font-bold h-9 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 shrink-0"
                disabled
                onClick={() => onFocusedChange(true)}
              >
                {submitLabel}
              </Button>
            </div>
          ) : (
            /* Expanded mode */
            <div className="flex flex-col gap-2">
              <textarea
                placeholder={placeholder}
                className="w-full bg-transparent border-none focus:outline-none text-lg resize-none min-h-[40px] py-1 placeholder:text-muted-foreground"
                value={value}
                onChange={(e) => {
                  onChange(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onFocus={() => onFocusedChange(true)}
                disabled={posting}
                rows={1}
              />

              <MediaUploader
                ref={mediaUploaderRef}
                media={media}
                onMediaChange={onMediaChange}
                disabled={posting}
                onUploadingChange={onUploadingChange}
              />

              <div className="flex items-center justify-between gap-3">
                {/* Left side: Action buttons */}
                <div className="flex-1 flex gap-1 text-primary">
                  {/* Image Upload Button */}
                  <button
                    className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full flex items-center justify-center disabled:opacity-50"
                    onClick={() => mediaUploaderRef.current?.triggerUpload()}
                    disabled={isUploading}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </button>

                  {/* Templates Dropdown */}
                  {templates.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full flex items-center justify-center">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {templates.map((template) => (
                          <DropdownMenuItem
                            key={template.id}
                            onClick={() => onApplyTemplate(template)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{template.name}</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Submit button */}
                <Button
                  className="rounded-full px-5 font-bold h-9 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  disabled={!canSubmit}
                  onClick={onSubmit}
                >
                  {posting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    submitLabel
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
