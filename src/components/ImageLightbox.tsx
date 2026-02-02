"use client"

import { useState, useCallback } from "react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import { Zoom, Counter } from "yet-another-react-lightbox/plugins"
import "yet-another-react-lightbox/plugins/counter.css"

interface MediaItem {
  url: string
  type: string
  description?: string | null
}

interface ImageLightboxProps {
  media: MediaItem[]
  initialIndex?: number
  open: boolean
  onClose: () => void
}

export function ImageLightbox({ media, initialIndex = 0, open, onClose }: ImageLightboxProps) {
  // Filter only images
  const slides = media
    .filter((item) => item.type === "image")
    .map((item) => ({
      src: item.url,
      alt: item.description || "",
    }))

  if (slides.length === 0 || !open) {
    return null
  }

  return <LightboxContent key={`${open}-${initialIndex}`} slides={slides} initialIndex={initialIndex} open={open} onClose={onClose} />
}

function LightboxContent({ slides, initialIndex, open, onClose }: {
  slides: { src: string; alt: string }[]
  initialIndex: number
  open: boolean
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)

  const handleIndexChange = useCallback(({ index: newIndex }: { index: number }) => {
    setIndex(newIndex)
  }, [])

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      on={{
        view: handleIndexChange,
      }}
      plugins={[Zoom, Counter]}
      zoom={{
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        scrollToZoom: true,
        doubleClickMaxStops: 2,
      }}
      carousel={{
        finite: slides.length === 1,
        padding: "20px",
      }}
      render={{
        buttonPrev: slides.length > 1 ? undefined : () => null,
        buttonNext: slides.length > 1 ? undefined : () => null,
      }}
      className="lightbox"
    />
  )
}
