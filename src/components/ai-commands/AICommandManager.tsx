"use client"

import { useState, useEffect } from "react"
import { aiCommandsApi } from "@/lib/api"
import { AICommand } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, Loader2, Sparkles, Command, X, ChevronRight } from "lucide-react"
import { AICommandEditDialog } from "./AICommandEditDialog"
import { cn } from "@/lib/utils"

export function AICommandManager() {
  const [commands, setCommands] = useState<AICommand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingCommand, setEditingCommand] = useState<AICommand | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newCommand, setNewCommand] = useState({
    label: "",
    description: "",
    action: "",
    prompt: "",
  })

  useEffect(() => {
    loadCommands()
  }, [])

  const loadCommands = async () => {
    setIsLoading(true)
    const result = await aiCommandsApi.getCommands()
    if (result.data) {
      setCommands(result.data)
    }
    setIsLoading(false)
  }

  const handleCreate = async () => {
    if (!newCommand.label || !newCommand.description || !newCommand.action || !newCommand.prompt) {
      return
    }

    const result = await aiCommandsApi.createCommand(newCommand)
    if (result.data) {
      setIsCreating(false)
      setNewCommand({ label: "", description: "", action: "", prompt: "" })
      loadCommands()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个AI命令吗？")) return

    await aiCommandsApi.deleteCommand(id)
    loadCommands()
  }

  const handleEdit = (command: AICommand) => {
    setEditingCommand(command)
    setIsEditDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-border -mx-4">
        {/* Header & Create Toggle */}
        <div className="px-6 py-4 flex items-center justify-between bg-muted/20">
          <div>
            <p className="text-xs text-muted-foreground">管理自定义 AI 处理指令</p>
          </div>
          <Button 
            size="sm" 
            className="rounded-full h-8 px-4 font-bold"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? "取消" : "新建命令"}
          </Button>
        </div>

        {/* Create Command Form */}
        {isCreating && (
          <div className="px-6 py-6 bg-muted/10 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-4 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold px-1">标签</label>
                  <Input
                    placeholder="例如：总结"
                    value={newCommand.label}
                    onChange={(e) => setNewCommand({ ...newCommand, label: e.target.value })}
                    className="rounded-xl border-border bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold px-1">标识符</label>
                  <Input
                    placeholder="例如：summarize"
                    value={newCommand.action}
                    onChange={(e) => setNewCommand({ ...newCommand, action: e.target.value })}
                    className="rounded-xl border-border bg-background font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold px-1">描述</label>
                <Input
                  placeholder="简要说明命令的作用"
                  value={newCommand.description}
                  onChange={(e) => setNewCommand({ ...newCommand, description: e.target.value })}
                  className="rounded-xl border-border bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold px-1">提示词模板</label>
                <Textarea
                  placeholder="输入提示词模板，使用 {content} 作为占位符"
                  value={newCommand.prompt}
                  onChange={(e) => setNewCommand({ ...newCommand, prompt: e.target.value })}
                  className="rounded-xl border-border bg-background min-h-[120px] font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newCommand.label || !newCommand.description || !newCommand.action || !newCommand.prompt}
                className="rounded-full w-full font-bold"
              >
                创建命令
              </Button>
            </div>
          </div>
        )}

        {/* Commands List */}
        <div className="divide-y divide-border">
          {commands.map((command) => (
            <div 
              key={command.id}
              className="px-4 py-4 hover:bg-muted/20 transition-colors group"
            >
              <div className="px-2 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="font-bold text-lg truncate">{command.label}</h4>
                    {command.isBuiltIn && (
                      <span className="bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                        系统
                      </span>
                    )}
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                      /{command.action}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                    {command.description}
                  </p>
                  <div className="relative">
                    <pre className="bg-muted/50 p-3 rounded-xl text-xs overflow-hidden max-h-20 whitespace-pre-wrap font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                      {command.prompt}
                    </pre>
                    <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-muted/50 to-transparent group-hover:from-muted/20" />
                  </div>
                </div>
                
                <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!command.isBuiltIn && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8"
                        onClick={() => handleEdit(command)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(command.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {commands.length === 0 && !isCreating && (
          <div className="py-20 text-center">
            <Command className="h-12 w-12 text-muted/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">还没有 AI 命令</p>
            <Button variant="link" className="mt-2 text-primary" onClick={() => setIsCreating(true)}>
              创建第一个命令
            </Button>
          </div>
        )}
      </div>

      <AICommandEditDialog
        command={editingCommand}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={loadCommands}
      />
    </>
  )
}
