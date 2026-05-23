"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { MediaGrid } from "@/components/MediaGrid"
import { ImageLightbox } from "@/components/ImageLightbox"

interface Media {
    id: string
    url: string
    type: string
    description: string | null
}

interface Props {
    children: React.ReactNode
    medias: Media[]
}

export default function ShareExpandable({ children, medias }: Props) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [allMedia, setAllMedia] = useState<Media[]>(medias)
    const contentRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const checkOverflow = () => {
            if (contentRef.current) {
                setHasMore(contentRef.current.scrollHeight > contentRef.current.clientHeight)
            }
        }
        const t1 = setTimeout(checkOverflow, 100)
        const t2 = setTimeout(checkOverflow, 300)
        return () => { clearTimeout(t1); clearTimeout(t2) }
    }, [children])

    // Add lightbox click handlers to server-rendered <img> tags
    useEffect(() => {
        if (!contentRef.current) return
        const imgs = Array.from(contentRef.current.querySelectorAll("img"))

        const markdownMedia: Media[] = imgs
            .map((img) => img.src)
            .filter(Boolean)
            .map((url) => ({ id: url, url, type: "image", description: null }))

        if (markdownMedia.length > 0) {
            setAllMedia([...medias, ...markdownMedia])
        }

        const handlers = imgs.map((img, i) => {
            const handler = () => {
                setLightboxIndex(medias.length + i)
                setLightboxOpen(true)
            }
            img.style.cursor = "pointer"
            img.addEventListener("click", handler)
            return { img, handler }
        })

        return () => {
            handlers.forEach(({ img, handler }) => img.removeEventListener("click", handler))
        }
    }, [medias])

    const handleMediaClick = (index: number) => {
        setLightboxIndex(index)
        setLightboxOpen(true)
    }

    return (
        <>
            <div
                ref={contentRef}
                className={cn(
                    "text-base leading-relaxed wrap-break-word text-foreground mb-4 overflow-hidden",
                    !isExpanded && "line-clamp-12"
                )}
                style={
                    !isExpanded
                        ? { display: "-webkit-box", WebkitLineClamp: 12, WebkitBoxOrient: "vertical" }
                        : {}
                }
            >
                {children}
            </div>

            {hasMore && !isExpanded && (
                <button
                    ref={buttonRef}
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const currentScrollY = window.scrollY
                        const buttonRect = buttonRef.current?.getBoundingClientRect()
                        setIsExpanded(true)
                        if (buttonRect) {
                            requestAnimationFrame(() => {
                                const targetScrollY = Math.max(
                                    0,
                                    currentScrollY + buttonRect.bottom - window.innerHeight * 0.7
                                )
                                window.scrollTo({ top: targetScrollY, behavior: "instant" })
                            })
                        }
                    }}
                    className="text-primary text-sm font-medium mb-4 hover:underline flex items-center gap-1"
                >
                    显示更多
                </button>
            )}

            <MediaGrid medias={medias} onImageClick={handleMediaClick} className="mb-4" />

            <ImageLightbox
                media={allMedia}
                initialIndex={lightboxIndex}
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
            />
        </>
    )
}
