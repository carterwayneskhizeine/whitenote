"use client"

import { MainLayout } from "@/components/layout/MainLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"

interface Template {
  id: string
  name: string
  content: string
  description: string | null
  isBuiltIn: boolean
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", description: "" })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      const json = await res.json()
      setTemplates(json.data || [])
    } catch (error) {
      console.error("Failed to fetch templates:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newTemplate.name || !newTemplate.content) return

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      })
      const json = await res.json()

      if (json.data) {
        setIsCreating(false)
        setNewTemplate({ name: "", content: "", description: "" })
        fetchTemplates()
      }
    } catch (error) {
      console.error("Failed to create template:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个模板吗？")) return

    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      fetchTemplates()
    } catch (error) {
      console.error("Failed to delete template:", error)
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">Templates</h1>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Templates</h1>
          <Button onClick={() => setIsCreating(!isCreating)}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {isCreating && (
          <Card className="border-dashed">
            <CardHeader><CardTitle>Create Template</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Template Name"
                value={newTemplate.name}
                onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
              />
              <Input
                placeholder="Description (Optional)"
                value={newTemplate.description}
                onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
              />
              <Textarea
                placeholder="Content..."
                value={newTemplate.content}
                onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
                className="min-h-[120px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newTemplate.name || !newTemplate.content}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {templates.map(t => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {t.name}
                  {t.isBuiltIn && <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded">System</span>}
                </CardTitle>
                {!t.isBuiltIn && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {t.description && <p className="text-sm text-muted-foreground mb-2">{t.description}</p>}
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                  {t.content}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        {templates.length === 0 && !isCreating && (
          <div className="text-center py-12 text-muted-foreground">
            <p>还没有模板</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsCreating(true)}>
              创建第一个模板
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
