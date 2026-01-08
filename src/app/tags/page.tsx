"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Plus, Search, Hash, Trash2 } from "lucide-react"
import { tagsApi } from "@/lib/api/tags"
import { Tag } from "@/types/api"

export default function TagsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#3B82F6")
  const [creating, setCreating] = useState(false)
  const [cleaning, setCleaning] = useState(false)

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

  // Cleanup unused tags
  const handleCleanupUnusedTags = async () => {
    if (cleaning) return

    const unusedCount = tags.filter((tag) => (tag.count ?? 0) === 0).length
    if (unusedCount === 0) {
      alert("没有需要清理的标签")
      return
    }

    if (!confirm(`确定要清理 ${unusedCount} 个未使用的标签吗？`)) {
      return
    }

    setCleaning(true)
    try {
      const result = await tagsApi.cleanupUnusedTags()
      if (result.data) {
        // Remove tags with 0 count from the list
        setTags(tags.filter((tag) => (tag.count ?? 0) > 0))
        alert(`已清理 ${result.data.deletedCount} 个未使用的标签`)
      }
    } catch (error) {
      console.error("Failed to cleanup tags:", error)
      alert("清理标签失败")
    } finally {
      setCleaning(false)
    }
  }

  // Filter tags by search query
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Count unused tags
  const unusedTagsCount = tags.filter((tag) => (tag.count ?? 0) === 0).length

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
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold mb-4">Tags</h1>

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

          {/* Cleanup unused tags button */}
          {unusedTagsCount > 0 && (
            <Button
              className="w-full mt-2 rounded-full font-bold bg-destructive hover:bg-destructive/90"
              onClick={handleCleanupUnusedTags}
              disabled={cleaning}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              {cleaning ? "清理中..." : `清理未使用标签 (${unusedTagsCount})`}
            </Button>
          )}
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
                      {tag.count ?? 0} 条消息
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
