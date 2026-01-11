"use client"

import { MessagesList } from "@/components/MessagesList"
import { useMemo, useState, useEffect } from "react"
import { commentsApi } from "@/lib/api"
import { Comment } from "@/types/api"
import { Loader2 } from "lucide-react"
import { TipTapViewer } from "@/components/TipTapViewer"
import { GoldieAvatar } from "@/components/GoldieAvatar"
import { cn, getHandle } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { QuotedMessageCard } from "@/components/QuotedMessageCard"

export default function FavoritesPage() {
  const router = useRouter()
  // Use useMemo to prevent infinite re-renders
  const filters = useMemo(() => ({ isStarred: true, rootOnly: false }), [])
  const [starredComments, setStarredComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)

  useEffect(() => {
    const fetchStarredComments = async () => {
      setLoadingComments(true)
      try {
        const result = await commentsApi.getStarredComments()
        if (result.data) {
          setStarredComments(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch starred comments:", error)
      } finally {
        setLoadingComments(false)
      }
    }

    fetchStarredComments()
  }, [])

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN,
      })
    } catch {
      return ""
    }
  }

  return (
    <>
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b p-4">
        <h1 className="text-xl font-bold">收藏</h1>
      </div>

      {/* Starred Messages */}
      <MessagesList filters={filters} />

      {/* Starred Comments Section */}
      <div className="border-t">
        {loadingComments ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : starredComments.length > 0 ? (
          <div>
            {starredComments.map((comment) => (
              <div
                key={comment.id}
                className="p-4 border-b hover:bg-muted/5 transition-colors cursor-pointer"
                onClick={() => router.push(`/status/${comment.messageId}/comment/${comment.id}`)}
              >
                <div className="flex gap-3">
                  <GoldieAvatar
                    name={comment.author?.name || null}
                    avatar={comment.author?.avatar || null}
                    size="lg"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-sm hover:underline">
                        {comment.author?.name || "GoldieRill"}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        @{getHandle(comment.author?.email || null, !!comment.author)}
                      </span>
                      <span className="text-muted-foreground text-sm">·</span>
                      <span className="text-muted-foreground text-sm hover:underline">
                        {formatTime(comment.createdAt)}
                      </span>
                      <span className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
                        收藏的评论
                      </span>
                    </div>
                    <div className="mt-1 text-sm leading-normal">
                      <TipTapViewer content={comment.content} />
                    </div>

                    {comment.quotedMessage && (
                      <QuotedMessageCard message={comment.quotedMessage} className="mt-2" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
