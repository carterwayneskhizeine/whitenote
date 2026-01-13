"use client"

import { useState } from "react"
import { TipTapViewer } from "@/components/TipTapViewer"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { MediaGrid } from "@/components/MediaGrid"
import { UserInfoWithTags } from "@/components/UserInfoWithTags"
import { ImageLightbox } from "@/components/ImageLightbox"

interface QuotedMessage {
  id: string
  content: string
  createdAt: string
  messageId?: string
  author: {
    id: string
    name: string | null
    avatar: string | null
    email: string | null
  } | null
  medias?: Array<{
    id: string
    url: string
    type: string
    description?: string | null
  }>
  tags?: Array<{
    tag: {
      id: string
      name: string
      color?: string | null
    }
  }>
}

interface QuotedMessageCardProps {
  message: QuotedMessage
  className?: string
}

export function QuotedMessageCard({ message, className }: QuotedMessageCardProps) {
  const router = useRouter()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // If it has a messageId, it's a comment - navigate to the comment's URL
    if (message.messageId) {
      router.push(`/status/${message.messageId}/comment/${message.id}`)
    } else {
      // Otherwise, it's a message - navigate to the message's URL
      router.push(`/status/${message.id}`)
    }
  }

  const handleImageClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <>
    <div
      onClick={handleClick}
      className={cn(
        "mt-3 border border-border rounded-2xl p-3 cursor-pointer hover:bg-muted/30 transition-colors",
        className
      )}
    >
      {/* Header: Author info */}
      <div className="flex items-center gap-2 text-sm mb-2 flex-wrap">
        <GoldieAvatar
          name={message.author?.name || null}
          avatar={message.author?.avatar || null}
          size="sm"
          isAI={!message.author}
        />
        <UserInfoWithTags
          author={message.author}
          createdAt={message.createdAt}
          tags={message.tags}
          size="sm"
          align="center"
          containerClassName="text-sm"
          showAIIndicator={false}
        />
      </div>

      {/* Message Content - truncated to 2 lines */}
      <div className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
        <TipTapViewer content={message.content} />
      </div>

      {/* Media Display - grid layout */}
      <MediaGrid
        medias={message.medias || []}
        onImageClick={handleImageClick}
        className="mt-2"
      />
    </div>

    {/* Image Lightbox */}
    <ImageLightbox
      media={message.medias || []}
      initialIndex={lightboxIndex}
      open={lightboxOpen}
      onClose={() => setLightboxOpen(false)}
    />
  </>
  )
}
