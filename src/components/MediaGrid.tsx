"use client"

import { cn } from "@/lib/utils"
import { ImagePlayer } from "@/components/ImagePlayer"
import { VideoPlayer } from "@/components/VideoPlayer"

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

export function MediaGrid({ medias, onImageClick, className }: MediaGridProps) {
  if (!medias || medias.length === 0) return null

  const mediaCount = medias.length
  const hasOnlyVideo = mediaCount === 1 && medias[0].type === "video"
  const hasSingleImage = mediaCount === 1 && medias[0].type === "image"

  return (
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
          "relative overflow-hidden",
          !hasOnlyVideo && !hasSingleImage && mediaCount === 1 && "aspect-auto",
          !hasOnlyVideo && !hasSingleImage && mediaCount !== 1 && "aspect-square",
          mediaCount === 3 && index === 0 && "col-span-2"
        )}>
          {media.type === "image" ? (
            mediaCount === 1 ? (
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
            )
          ) : media.type === "video" ? (
            <VideoPlayer
              src={media.url}
              className={hasOnlyVideo ? "rounded-xl border border-border/50 bg-black" : "w-full h-full"}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}
