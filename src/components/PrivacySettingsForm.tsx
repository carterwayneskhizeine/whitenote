"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save } from "lucide-react"
import { configApi } from "@/lib/api/config"
import { AIConfig } from "@/types/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { setCommentSortOrder } from "@/lib/comment-sort"

interface PrivacySettingsFormProps {
  onSuccess?: () => void
}

export function PrivacySettingsForm({ onSuccess }: PrivacySettingsFormProps) {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const result = await configApi.getConfig()
      if (result.data) {
        setConfig(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch config:", error)
      showMessage("error", "加载配置失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSave = async () => {
    if (!config || saving) return

    setSaving(true)
    try {
      const updateData = {
        shareCommentsOrderNewestFirst: config.shareCommentsOrderNewestFirst,
      }

      const result = await configApi.updateConfig(updateData)

      if (result.data) {
        setConfig({ ...config, ...result.data })
        // Also save to localStorage for public share pages
        setCommentSortOrder(config.shareCommentsOrderNewestFirst)
        showMessage("success", "设置保存成功")
        onSuccess?.()
      } else if (result.error) {
        showMessage("error", result.error)
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      showMessage("error", "保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="divide-y divide-border -mx-4 border-t border-border">
      {/* Share Comments Sort Order */}
      <div className="px-4 py-6 hover:bg-muted/30 transition-colors">
        <div className="px-2 flex items-center justify-between">
          <div>
            <label className="text-sm font-bold block">分享帖子的评论区排序</label>
            <p className="text-xs text-muted-foreground mt-1">
              {config.shareCommentsOrderNewestFirst
                ? "最新的评论和回复将显示在前面"
                : "最早的评论和回复将显示在前面"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {config.shareCommentsOrderNewestFirst ? "最新靠前" : "最早靠前"}
            </span>
            <Switch
              checked={config.shareCommentsOrderNewestFirst}
              onCheckedChange={(checked) =>
                setConfig({ ...config, shareCommentsOrderNewestFirst: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Save Actions */}
      <div className="px-4 py-8 bg-background sticky bottom-0 z-20 border-t border-border">
        {message && (
          <div className={cn(
            "mb-4 p-4 rounded-xl text-sm font-medium mx-2",
            message.type === "success" ? "bg-green-500/10 text-green-600 border border-green-500/20" : "bg-red-500/10 text-red-600 border border-red-500/20"
          )}>
            {message.text}
          </div>
        )}
        <div className="px-2">
          <Button
            className="w-full rounded-full h-12 font-bold bg-foreground text-background hover:bg-foreground/90 transition-all text-lg"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "保存设置"}
          </Button>
        </div>
      </div>
    </div>
  )
}
