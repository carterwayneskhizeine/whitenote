"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { workspacesApi } from "@/lib/api/workspaces"
import type { Workspace, UpdateWorkspaceInput } from "@/types/api"
import { Loader2, Trash2, Edit2, Check, X, Plus, Layers, Database } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function WorkspaceManager() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [isInitializingRAG, setIsInitializingRAG] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editEnableAutoTag, setEditEnableAutoTag] = useState(true)
  const [editEnableBriefing, setEditEnableBriefing] = useState(true)

  // 加载 Workspace 列表
  const fetchWorkspaces = async () => {
    setIsLoading(true)
    try {
      const result = await workspacesApi.getWorkspaces()
      if (result.data) {
        setWorkspaces(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  // 创建新 Workspace
  const handleCreate = async () => {
    if (!newName.trim()) return

    setIsCreating(true)
    try {
      const result = await workspacesApi.createWorkspace({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      })

      if (result.data) {
        setWorkspaces([...workspaces, result.data])
        setNewName("")
        setNewDescription("")
      } else if (result.error) {
        alert(`创建失败: ${result.error}`)
      }
    } catch (error) {
      console.error("Failed to create workspace:", error)
      alert("创建失败，请检查网络连接")
    } finally {
      setIsCreating(false)
    }
  }

  // 开始编辑
  const handleStartEdit = (workspace: Workspace) => {
    setEditingId(workspace.id)
    setEditName(workspace.name)
    setEditDescription(workspace.description || "")
    setEditEnableAutoTag(workspace.enableAutoTag)
    setEditEnableBriefing(workspace.enableBriefing)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditDescription("")
    setEditEnableAutoTag(true)
    setEditEnableBriefing(true)
  }

  // 保存编辑
  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return

    setIsUpdating(id)
    try {
      const updateData: UpdateWorkspaceInput = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        enableAutoTag: editEnableAutoTag,
        enableBriefing: editEnableBriefing,
      }

      const result = await workspacesApi.updateWorkspace(id, updateData)

      if (result.data) {
        setWorkspaces(workspaces.map((w) => (w.id === id ? result.data! : w)))
        setEditingId(null)
      } else if (result.error) {
        alert(`更新失败: ${result.error}`)
      }
    } catch (error) {
      console.error("Failed to update workspace:", error)
      alert("更新失败，请检查网络连接")
    } finally {
      setIsUpdating(null)
    }
  }

  // 删除 Workspace
  const handleDelete = async (id: string) => {
    const workspace = workspaces.find((w) => w.id === id)
    if (!workspace) return

    if (workspace.isDefault) {
      alert("默认工作区不能删除")
      return
    }

    if (!confirm(`确定要删除工作区 "${workspace.name}" 吗？\n\n此操作将同时删除：\n- 该工作区的所有消息\n- RAGFlow 知识库和对话配置`)) {
      return
    }

    try {
      const result = await workspacesApi.deleteWorkspace(id)
      if (result.success) {
        setWorkspaces(workspaces.filter((w) => w.id !== id))
      } else if (result.error) {
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error("Failed to delete workspace:", error)
      alert("删除失败，请检查网络连接")
    }
  }

  // 初始化 RAGFlow
  const handleInitializeRAG = async (id: string) => {
    const workspace = workspaces.find((w) => w.id === id)
    if (!workspace) return

    if (!confirm(`为工作区 "${workspace.name}" 初始化 RAGFlow 资源？\n\n这将创建：\n- 独立的知识库（Dataset）\n- 独立的 AI 助手对话（Chat）\n\n请确保您已在 AI 设置中配置了 RAGFlow Base URL 和 API Key。`)) {
      return
    }

    setIsInitializingRAG(id)
    try {
      const result = await workspacesApi.initializeRAGFlow(id)
      if (result.data) {
        setWorkspaces(workspaces.map((w) => (w.id === id ? result.data! : w)))
        alert(`RAGFlow 资源初始化成功！\n\n知识库 ID: ${result.data.ragflowDatasetId}\n对话 ID: ${result.data.ragflowChatId}`)
      } else if (result.error) {
        alert(`初始化失败: ${result.error}`)
      }
    } catch (error) {
      console.error("Failed to initialize RAGFlow:", error)
      alert("初始化失败，请检查网络连接和 RAGFlow 配置")
    } finally {
      setIsInitializingRAG(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 新建 Workspace */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          新建工作区
        </h3>
        <div className="space-y-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="工作区名称，如：编程技术"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="描述（可选）"
            rows={2}
          />
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                创建工作区
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          💡 创建后将自动配置独立的 RAGFlow 知识库和对话
        </p>
      </Card>

      {/* Workspace 列表 */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5" />
          我的工作区
        </h3>
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="border rounded-lg p-4 space-y-3 hover:bg-secondary/30 transition-colors"
            >
              {editingId === ws.id ? (
                // 编辑模式
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`edit-name-${ws.id}`} className="text-sm">
                      名称
                    </Label>
                    <Input
                      id={`edit-name-${ws.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="工作区名称"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-desc-${ws.id}`} className="text-sm">
                      描述
                    </Label>
                    <Textarea
                      id={`edit-desc-${ws.id}`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="描述（可选）"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`edit-autotag-${ws.id}`}
                          checked={editEnableAutoTag}
                          onCheckedChange={setEditEnableAutoTag}
                        />
                        <Label htmlFor={`edit-autotag-${ws.id}`} className="text-sm">
                          自动打标签
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`edit-briefing-${ws.id}`}
                          checked={editEnableBriefing}
                          onCheckedChange={setEditEnableBriefing}
                        />
                        <Label htmlFor={`edit-briefing-${ws.id}`} className="text-sm">
                          每日晨报
                        </Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={isUpdating === ws.id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(ws.id)}
                        disabled={!editName.trim() || isUpdating === ws.id}
                      >
                        {isUpdating === ws.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                // 查看模式
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold truncate">{ws.name}</h4>
                      {ws.isDefault && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex-shrink-0">
                          默认
                        </span>
                      )}
                    </div>
                    {ws.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {ws.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>自动标签: {ws.enableAutoTag ? "✓" : "✗"}</span>
                      <span>每日晨报: {ws.enableBriefing ? "✓" : "✗"}</span>
                      <span className={ws.ragflowDatasetId ? "text-green-600" : "text-orange-600"}>
                        RAGFlow: {ws.ragflowDatasetId ? "✓" : "未配置"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {!ws.ragflowDatasetId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleInitializeRAG(ws.id)}
                        disabled={isInitializingRAG === ws.id}
                        title="初始化 RAGFlow 知识库"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {isInitializingRAG === ws.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Database className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(ws)}
                      title="编辑"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(ws.id)}
                      disabled={ws.isDefault}
                      title={ws.isDefault ? "默认工作区不能删除" : "删除"}
                      className={ws.isDefault ? "opacity-50 cursor-not-allowed" : "text-destructive hover:text-destructive"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {workspaces.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            暂无工作区，请创建第一个工作区
          </div>
        )}
      </Card>
    </div>
  )
}
