"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { workspacesApi } from "@/lib/api/workspaces"
import type { Workspace, UpdateWorkspaceInput } from "@/types/api"
import { Loader2, Trash2, Edit2, Check, X, Plus, Layers, Database, MoreHorizontal, Settings2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchWorkspaces = async () => {
    setIsLoading(true)
    try {
      const result = await workspacesApi.getWorkspaces()
      if (result.data) setWorkspaces(result.data)
    } catch (error) {
      console.error("Failed to fetch workspaces:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

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
        setShowCreateForm(false)
      } else if (result.error) {
        alert(`创建失败: ${result.error}`)
      }
    } catch (error) {
      alert("创建失败，请检查网络连接")
    } finally {
      setIsCreating(false)
    }
  }

  const handleStartEdit = (workspace: Workspace) => {
    setEditingId(workspace.id)
    setEditName(workspace.name)
    setEditDescription(workspace.description || "")
    setEditEnableAutoTag(workspace.enableAutoTag)
    setEditEnableBriefing(workspace.enableBriefing)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
  }

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
      alert("更新失败，请检查网络连接")
    } finally {
      setIsUpdating(null)
    }
  }

  const handleDelete = async (id: string) => {
    const workspace = workspaces.find((w) => w.id === id)
    if (!workspace || workspace.isDefault) return
    if (!confirm(`确定要删除工作区 "${workspace.name}" 吗？`)) return
    try {
      const result = await workspacesApi.deleteWorkspace(id)
      if (result.success) {
        setWorkspaces(workspaces.filter((w) => w.id !== id))
      }
    } catch (error) {
      alert("删除失败")
    }
  }

  const handleInitializeRAG = async (id: string) => {
    const workspace = workspaces.find((w) => w.id === id)
    if (!workspace) return
    if (!confirm(`为工作区 "${workspace.name}" 初始化 RAGFlow 资源？`)) return
    setIsInitializingRAG(id)
    try {
      const result = await workspacesApi.initializeRAGFlow(id)
      if (result.data) {
        setWorkspaces(workspaces.map((w) => (w.id === id ? result.data! : w)))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsInitializingRAG(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="divide-y divide-border -mx-4">
      {/* Header & Create Toggle */}
      <div className="px-6 py-4 flex items-center justify-between bg-muted/20">
        <div>
          <p className="text-xs text-muted-foreground">管理独立的知识库和同步配置</p>
        </div>
        <Button 
          size="sm" 
          className="rounded-full h-8 px-4 font-bold"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? "取消" : "新建工作区"}
        </Button>
      </div>

      {/* New Workspace Form */}
      {showCreateForm && (
        <div className="px-6 py-6 bg-muted/10 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-4 max-w-xl">
            <div className="space-y-1">
              <label className="text-sm font-bold px-1">工作区名称</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：个人知识库"
                className="rounded-xl bg-background border-border focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold px-1">描述（可选）</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="简要说明工作区的用途"
                className="rounded-xl bg-background border-border focus-visible:ring-primary/20 min-h-[80px]"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || isCreating}
              className="rounded-full w-full font-bold"
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              创建工作区
            </Button>
          </div>
        </div>
      )}

      {/* Workspace List */}
      <div className="divide-y divide-border">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={cn(
              "px-4 py-4 transition-colors",
              editingId === ws.id ? "bg-muted/30" : "hover:bg-muted/20"
            )}
          >
            {editingId === ws.id ? (
              // Edit Mode
              <div className="px-2 space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">名称</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg h-9 border-border bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">描述</Label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="rounded-lg min-h-[60px] border-border bg-background text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6 py-2">
                  <div className="flex items-center gap-2">
                    <Switch id={`tag-${ws.id}`} checked={editEnableAutoTag} onCheckedChange={setEditEnableAutoTag} />
                    <Label htmlFor={`tag-${ws.id}`} className="text-sm cursor-pointer">自动打标签</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id={`br-${ws.id}`} checked={editEnableBriefing} onCheckedChange={setEditEnableBriefing} />
                    <Label htmlFor={`br-${ws.id}`} className="text-sm cursor-pointer">每日晨报</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={handleCancelEdit}>
                    取消
                  </Button>
                  <Button size="sm" className="rounded-full px-6 font-bold" onClick={() => handleSaveEdit(ws.id)} disabled={isUpdating === ws.id}>
                    {isUpdating === ws.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存更改"}
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="px-2 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg truncate">{ws.name}</h4>
                    {ws.isDefault && (
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                        默认
                      </span>
                    )}
                  </div>
                  {ws.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                      {ws.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <div className={cn("h-1.5 w-1.5 rounded-full", ws.enableAutoTag ? "bg-green-500" : "bg-muted-foreground/30")} />
                      自动标签
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <div className={cn("h-1.5 w-1.5 rounded-full", ws.enableBriefing ? "bg-green-500" : "bg-muted-foreground/30")} />
                      每日晨报
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <div className={cn("h-1.5 w-1.5 rounded-full", ws.ragflowDatasetId ? "bg-green-500" : "bg-orange-500")} />
                      <span className={cn(ws.ragflowDatasetId ? "text-green-600" : "text-orange-600")}>
                        RAGFlow {ws.ragflowDatasetId ? "就绪" : "待初始化"}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  {!ws.ragflowDatasetId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => handleInitializeRAG(ws.id)}
                      disabled={isInitializingRAG === ws.id}
                    >
                      {isInitializingRAG === ws.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                      初始化
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-8 w-8 text-muted-foreground"
                      onClick={() => handleInitializeRAG(ws.id)}
                      title="重置 RAGFlow"
                    >
                      <Database className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-8 w-8"
                    onClick={() => handleStartEdit(ws)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("rounded-full h-8 w-8 text-destructive", ws.isDefault && "opacity-0 pointer-events-none")}
                    onClick={() => handleDelete(ws.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {workspaces.length === 0 && (
          <div className="py-20 text-center">
            <Layers className="h-12 w-12 text-muted/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">暂无工作区</p>
            <Button variant="link" className="mt-2 text-primary" onClick={() => setShowCreateForm(true)}>
              立即创建第一个工作区
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

