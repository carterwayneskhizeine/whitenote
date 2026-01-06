"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tag as TagIcon, Plus, Search, Hash } from "lucide-react"
import { tagsApi } from "@/lib/api/tags"
import { Tag } from "@/types/api"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

export default function TagsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#3B82F6")
  const [creating, setCreating] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // Fetch tags
  const fetchTags = async () => {
    setLoading(true)
    try {
      const result = await tagsApi.getTags()
      if (result.data) {
        setTags(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      fetchTags()
    }
  }, [status])

  // Create new tag
  const handleCreateTag = async () => {
    if (!newTagName.trim() || creating) return

    setCreating(true)
    try {
      const result = await tagsApi.createTag({
        name: newTagName.trim(),
        color: newTagColor,
      })

      if (result.data) {
        setTags([...tags, result.data])
        setNewTagName("")
        setNewTagColor("#3B82F6")
        setShowCreateDialog(false)
      }
    } catch (error) {
      console.error("Failed to create tag:", error)
    } finally {
      setCreating(false)
    }
  }

  // Filter tags by search query
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold mb-4">标签</h1>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full"
            />
          </div>

          {/* Create button */}
          <Button
            className="w-full mt-3 rounded-full font-bold bg-primary hover:bg-primary/90"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            创建标签
          </Button>
        </div>
      </div>

      {/* Create tag dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">创建新标签</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">标签名称</label>
                <Input
                  placeholder="例如: 学习"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTag()
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">标签颜色</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-20 h-10 p-1"
                  />
                  <Input
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateDialog(false)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || creating}
                >
                  {creating ? "创建中..." : "创建"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tags list */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {filteredTags.length === 0 ? (
          <div className="text-center py-12">
            <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchQuery ? "未找到匹配的标签" : "还没有标签"}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(true)}
              >
                创建第一个标签
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => router.push(`/?tag=${tag.id}`)}
                className="w-full text-left p-4 rounded-xl border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: tag.color ? `${tag.color}20` : "rgba(59, 130, 246, 0.2)" }}
                  >
                    <Hash
                      className="h-5 w-5"
                      style={{ color: tag.color || "#3B82F6" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">#{tag.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {tag.count || 0} 条消息
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
