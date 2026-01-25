"use client"

import { useState, useEffect } from "react"
import { templatesApi } from "@/lib/api"
import { Template } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, Loader2, FileText, ChevronRight, X } from "lucide-react"
import { TemplateEditDialog } from "./TemplateEditDialog"
import { cn } from "@/lib/utils"

export function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    content: "",
    description: "",
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setIsLoading(true)
    const result = await templatesApi.getTemplates()
    if (result.data) {
      setTemplates(result.data)
    }
    setIsLoading(false)
  }

  const handleCreate = async () => {
    if (!newTemplate.name || !newTemplate.content) return

    const result = await templatesApi.createTemplate(newTemplate)
    if (result.data) {
      setIsCreating(false)
      setNewTemplate({ name: "", content: "", description: "" })
      loadTemplates()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个模板吗？")) return

    await templatesApi.deleteTemplate(id)
    loadTemplates()
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
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
            <h3 className="text-xl font-bold">模板管理</h3>
            <p className="text-xs text-muted-foreground">管理和编辑消息快捷模板</p>
          </div>
          <Button 
            size="sm" 
            className="rounded-full h-8 px-4 font-bold"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? "取消" : "新建模板"}
          </Button>
        </div>

        {/* Create Template Form */}
        {isCreating && (
          <div className="px-6 py-6 bg-muted/10 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <label className="text-sm font-bold px-1">模板名称</label>
                <Input
                  placeholder="例如：周报模板"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="rounded-xl border-border bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold px-1">描述（可选）</label>
                <Input
                  placeholder="简要说明模板用途"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="rounded-xl border-border bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold px-1">内容</label>
                <Textarea
                  placeholder="输入模板内容，支持 Markdown"
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  className="rounded-xl border-border bg-background min-h-[120px] font-mono text-sm"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newTemplate.name || !newTemplate.content}
                className="rounded-full w-full font-bold"
              >
                创建模板
              </Button>
            </div>
          </div>
        )}

        {/* Templates List */}
        <div className="divide-y divide-border">
          {templates.map((template) => (
            <div 
              key={template.id}
              className="px-4 py-4 hover:bg-muted/20 transition-colors group"
            >
              <div className="px-2 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="font-bold text-lg truncate">{template.name}</h4>
                    {template.isBuiltIn && (
                      <span className="bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                        系统
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {template.description}
                    </p>
                  )}
                  <div className="relative">
                    <pre className="bg-muted/50 p-3 rounded-xl text-xs overflow-hidden max-h-20 whitespace-pre-wrap font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                      {template.content}
                    </pre>
                    <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-muted/50 to-transparent group-hover:from-muted/20" />
                  </div>
                </div>
                
                <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!template.isBuiltIn && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(template.id)}
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
        {templates.length === 0 && !isCreating && (
          <div className="py-20 text-center">
            <FileText className="h-12 w-12 text-muted/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">还没有模板</p>
            <Button variant="link" className="mt-2 text-primary" onClick={() => setIsCreating(true)}>
              创建第一个模板
            </Button>
          </div>
        )}
      </div>

      <TemplateEditDialog
        template={editingTemplate}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={loadTemplates}
      />
    </>
  )
}
