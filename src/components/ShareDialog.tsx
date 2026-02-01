"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Share2, Link2, Check } from "lucide-react"
import { useState, useEffect } from "react"

interface ShareDialogProps {
    messageId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    type?: 'message' | 'comment'  // 区分是帖子还是评论
}

export function ShareDialog({
    messageId,
    open,
    onOpenChange,
    type = 'message',  // 默认为帖子
}: ShareDialogProps) {
    const [shareUrl, setShareUrl] = useState("")
    const [copied, setCopied] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    // Generate share URL when dialog opens
    useEffect(() => {
        if (open && messageId) {
            // 根据类型生成不同的URL
            const url = type === 'comment'
                ? `${window.location.origin}/share/comment/${messageId}`
                : `${window.location.origin}/share/${messageId}`
            setShareUrl(url)
            setCopied(false)
        }
    }, [open, messageId, type])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            setIsAnimating(true)

            // Reset animation after it completes
            setTimeout(() => {
                setIsAnimating(false)
            }, 300)

            // Reset copied state after 2 seconds
            setTimeout(() => {
                setCopied(false)
            }, 2000)
        } catch (error) {
            console.error("Failed to copy link:", error)
        }
    }

    const handleVisit = () => {
        window.open(shareUrl, '_blank')
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <Share2 className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle className="text-lg">分享{type === 'comment' ? '评论' : '帖子'}</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* URL Input Box */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Link2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                className="w-full pl-10 pr-4 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                onClick={(e) => e.currentTarget.select()}
                            />
                        </div>
                        <Button
                            onClick={handleCopy}
                            className={`
                                min-w-10.5 px-3 transition-all duration-200
                                ${copied ? 'bg-green-600 hover:bg-green-700' : ''}
                            `}
                        >
                            {copied ? (
                                <Check className={`h-4 w-4 ${isAnimating ? 'animate-in zoom-in duration-200' : ''}`} />
                            ) : (
                                <Link2 className="h-4 w-4" />
                            )}
                        </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex pt-2">
                        <Button
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={handleVisit}
                        >
                            <Share2 className="h-4 w-4" />
                            在新窗口打开
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
