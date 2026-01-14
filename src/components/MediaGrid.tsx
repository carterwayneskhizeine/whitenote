"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ImagePlayer } from "@/components/ImagePlayer"
import { VideoPlayer } from "@/components/VideoPlayer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

export interface MediaItem {
  id: string
  url: string
  type: string
  description?: string | null
}

interface MediaGridProps {
  medias: MediaItem[]
  onImageClick?: (index: number, e: React.MouseEvent) => void
  className?: string
}

function ImageDescriptionDialog({
  open,
  onOpenChange,
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  description: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(description)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>图片描述</DialogTitle>
          <DialogDescription>由 AI 生成的图片描述</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-muted rounded-lg max-h-[300px] overflow-y-auto">
            <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">{description}</p>
          </div>
          <Button onClick={handleCopy} className="w-full" variant="default">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                一键复制
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function MediaGrid({ medias, onImageClick, className }: MediaGridProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const isMobile = useMobile()

  if (!medias || medias.length === 0) return null

  const mediaCount = medias.length
  const hasOnlyVideo = mediaCount === 1 && medias[0].type === "video"
  const hasSingleImage = mediaCount === 1 && medias[0].type === "image"

  return (
    <>
      <div className={cn(
        "grid gap-1",
        !hasOnlyVideo && !hasSingleImage && "rounded-lg overflow-hidden border border-border",
        mediaCount === 1 && "grid-cols-1",
        mediaCount === 2 && "grid-cols-2",
        mediaCount === 3 && "grid-cols-2",
        mediaCount === 4 && "grid-cols-2",
        className
      )}>
        {medias.map((media, index) => (
          <div key={media.id} className={cn(
            "relative overflow-hidden group",
            !hasOnlyVideo && !hasSingleImage && mediaCount === 1 && "aspect-auto",
            !hasOnlyVideo && !hasSingleImage && mediaCount !== 1 && "aspect-square",
            mediaCount === 3 && index === 0 && "col-span-2"
          )}>
            {media.type === "image" ? (
              <>
                {mediaCount === 1 ? (
                  <ImagePlayer
                    src={media.url}
                    alt={media.description || ""}
                    className="rounded-lg overflow-hidden border border-border"
                    onClick={(e) => onImageClick?.(index, e)}
                  />
                ) : (
                  <img
                    src={media.url}
                    alt={media.description || ""}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={(e) => onImageClick?.(index, e)}
                  />
                )}
                {/* ALT 标签 */}
                {media.description && (
                  <button
                    onClick={() => setSelectedMedia(media)}
                    className={`absolute bottom-2 left-2 px-2 py-1 bg-black/70 hover:bg-black/80 text-white text-xs font-medium rounded backdrop-blur-sm transition-all ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    ALT
                  </button>
                )}
              </>
            ) : media.type === "video" ? (
              <VideoPlayer
                src={media.url}
                className={hasOnlyVideo ? "rounded-xl border border-border/50 bg-black" : "w-full h-full"}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* 图片描述弹窗 */}
      {selectedMedia && selectedMedia.description && (
        <ImageDescriptionDialog
          open={!!selectedMedia}
          onOpenChange={(open) => !open && setSelectedMedia(null)}
          description={selectedMedia.description}
        />
      )}
    </>
  )
}
