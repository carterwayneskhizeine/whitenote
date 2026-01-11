"use client"

import { useRef, useState, forwardRef, useImperativeHandle } from "react"
import { X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MediaItem {
  url: string
  type: string
  name: string
}

export interface MediaUploaderRef {
  triggerUpload: () => void
}

interface MediaUploaderProps {
  media: MediaItem[]
  onMediaChange: (media: MediaItem[]) => void
  disabled?: boolean
  maxImages?: number
  maxVideos?: number
  onUploadingChange?: (isUploading: boolean) => void
}

export const MediaUploader = forwardRef<MediaUploaderRef, MediaUploaderProps>(({
  media,
  onMediaChange,
  disabled = false,
  maxImages = 4,
  maxVideos = 1,
  onUploadingChange,
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  useImperativeHandle(ref, () => ({
    triggerUpload: () => {
      fileInputRef.current?.click()
    },
  }))

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Check media type constraints
    const currentHasImage = media.some(m => m.type === "image")
    const currentHasVideo = media.some(m => m.type === "video")
    const imageCount = media.filter(m => m.type === "image").length

    // Validate new files
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isVideo = file.type.startsWith("video")
      const isImage = file.type.startsWith("image")

      // Cannot mix images and videos
      if (isVideo && currentHasImage) {
        alert("不能同时上传图片和视频")
        return
      }
      if (isImage && currentHasVideo) {
        alert("不能同时上传视频和图片")
        return
      }

      // Limit videos to 1
      if (isVideo && currentHasVideo) {
        alert("最多只能上传1个视频")
        return
      }

      // Limit images to maxImages
      if (isImage && imageCount + ([...files].slice(i).filter(f => f.type.startsWith("image")).length) > maxImages) {
        alert(`最多只能上传${maxImages}张图片`)
        return
      }
    }

    setIsUploading(true)
    onUploadingChange?.(true)
    try {
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Double check limits before uploading each file
        const isVideo = file.type.startsWith("video")
        const currentImageCount = media.filter(m => m.type === "image").length

        if (isVideo && media.some(m => m.type === "video")) {
          alert("最多只能上传1个视频")
          break
        }

        if (!isVideo && currentImageCount >= maxImages) {
          alert(`最多只能上传${maxImages}张图片`)
          break
        }

        // Create a new FormData for each file
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Upload failed")
        }

        const result = await response.json()
        if (result.data) {
          onMediaChange([
            ...media,
            {
              url: result.data.url,
              type: result.data.type,
              name: result.data.originalName,
            },
          ])
        }
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("File upload error:", error)
      alert(`上传失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setIsUploading(false)
      onUploadingChange?.(false)
    }
  }

  const handleRemoveMedia = (index: number) => {
    onMediaChange(media.filter((_, i) => i !== index))
  }

  return (
    <>
      {/* Media Previews */}
      {media.length > 0 && (
        <div className={cn(
          "grid gap-2 rounded-lg overflow-hidden",
          media.length === 1 && "grid-cols-1",
          media.length === 2 && "grid-cols-2",
          media.length === 3 && "grid-cols-2",
          media.length === 4 && "grid-cols-2"
        )}>
          {media.map((item, index) => (
            <div key={index} className={cn(
              "relative group aspect-square",
              media.length === 3 && index === 0 && "col-span-2"
            )}>
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                />
              )}
              <button
                onClick={() => handleRemoveMedia(index)}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.jff,.jpj,.png,.webp,.gif,.mp4,.mov,.m4v"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />
    </>
  )
})

MediaUploader.displayName = "MediaUploader"
