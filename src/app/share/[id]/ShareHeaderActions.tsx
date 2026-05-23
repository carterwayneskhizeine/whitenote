"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Link2, ArrowLeft, Share2, Copy, Check } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

interface Props {
    message: {
        id: string
        content: string
        authorName: string
        authorHandle: string
        createdAt: string
        tags: string[]
    }
}

export default function ShareHeaderActions({ message }: Props) {
    const router = useRouter()
    const [copied, setCopied] = useState(false)
    const [contentCopied, setContentCopied] = useState(false)

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (e) {
            console.error("Failed to copy link:", e)
        }
    }

    const handleCopyContent = async () => {
        try {
            const time = format(new Date(message.createdAt), "yyyy'年'M'月'd'日' HH:mm", { locale: zhCN })
            const tags = message.tags.length > 0
                ? "\n" + message.tags.map((t) => `#${t}`).join(" ")
                : ""
            const fullContent = `${message.authorName} (@${message.authorHandle})\n${time}${tags}\n\n${message.content}`
            await navigator.clipboard.writeText(fullContent)
            setContentCopied(true)
            setTimeout(() => setContentCopied(false), 2000)
        } catch (e) {
            console.error("Failed to copy content:", e)
        }
    }

    return (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
            <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-9 w-9"
                        onClick={() => router.push("/")}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" />
                        <span className="text-lg font-bold">分享帖子</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={copied ? "default" : "outline"}
                        size="icon"
                        className="rounded-full h-9 w-9"
                        onClick={handleCopyLink}
                    >
                        <Link2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={contentCopied ? "default" : "outline"}
                        size="icon"
                        className="rounded-full h-9 w-9"
                        onClick={handleCopyContent}
                    >
                        {contentCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}
