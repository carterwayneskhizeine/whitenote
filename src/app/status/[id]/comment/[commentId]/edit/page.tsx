"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { commentsApi } from "@/lib/api"
import { TipTapEditor } from "@/components/TipTapEditor"
import { TagInput } from "@/components/TagInput"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Tag } from "lucide-react"
import { Comment } from "@/types/api"

export default function EditCommentPage() {
  const { id, commentId } = useParams() as { id: string; commentId: string }
  const router = useRouter()
  const [comment, setComment] = useState<Comment | null>(null)
  const [content, setContent] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchComment = async () => {
      try {
        const result = await commentsApi.getComment(commentId)
        if (result.data) {
          setComment(result.data)
          setContent(result.data.content)
          // 提取现有标签
          setTags(result.data.tags?.map(({ tag }) => tag.name) || [])
        } else if (result.error) {
          setError(result.error)
        }
      } catch (err) {
        console.error("Failed to fetch comment:", err)
        setError("Failed to load comment")
      } finally {
        setIsLoading(false)
      }
    }

    if (commentId) {
      fetchComment()
    }
  }, [commentId])

  const handleSave = async () => {
    if (isSaving || !comment) return

    setIsSaving(true)
    try {
      console.log('[EditCommentPage] Saving comment:', comment.id, 'new content:', content.substring(0, 50))

      // 更新内容和标签
      const result = await commentsApi.updateComment(comment.id, {
        content,
        tags,
      })

      if (result.data) {
        console.log('[EditCommentPage] Saved successfully, navigating to:', `/status/${id}/comment/${comment.id}`)
        // 使用 router.push 而不是 router.replace，确保页面重新加载数据
        router.push(`/status/${id}/comment/${comment.id}`)
      }
    } catch (error) {
      console.error("Failed to save comment:", error)
      alert("保存失败，请重试")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Replace the current edit page in history with the comment detail page
    if (comment) {
      router.replace(`/status/${id}/comment/${comment.id}`)
    } else {
      router.back()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !comment) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">{error || "Comment not found"}</p>
        <Button onClick={() => router.replace(`/status/${id}`)}>返回消息</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleCancel}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">编辑评论</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCancel}
            disabled={isSaving}
            variant="ghost"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-20"
          >
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* Tags Section */}
      <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <TagInput
          tags={tags}
          onChange={setTags}
          className="flex-1"
        />
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-125">
        <TipTapEditor
          content={content}
          onChange={setContent}
          placeholder="编辑评论内容..."
          className="h-full min-h-125 border-0"
          editorContentClassName="h-full min-h-125 px-4 py-4"
        />
      </div>
    </div>
  )
}
