"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save, CheckCircle, XCircle, FileDown, FileUp, Database } from "lucide-react"
import { configApi } from "@/lib/api/config"
import { AIConfig } from "@/types/api"

interface AIConfigFormProps {
  onSuccess?: () => void
}

export function AIConfigForm({ onSuccess }: AIConfigFormProps) {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState<"export" | "import" | "ragflow" | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  // Session storage for user-inputted API keys (not persisted to backend as "***")
  const [sessionApiKeys, setSessionApiKeys] = useState<{ openai?: string; ragflow?: string; asr?: string }>({})

  // Fetch config
  const fetchConfig = async () => {
    setLoading(true)
    try {
      const result = await configApi.getConfig()
      if (result.data) {
        setConfig(result.data)

        // Restore API keys from sessionStorage if available
        const sessionOpenAIKey = sessionStorage.getItem('openai_api_key')
        const sessionRagflowKey = sessionStorage.getItem('ragflow_api_key')
        const sessionAsrKey = sessionStorage.getItem('asr_api_key')

        setSessionApiKeys({
          openai: sessionOpenAIKey || "",
          ragflow: sessionRagflowKey || "",
          asr: sessionAsrKey || "",
        })
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

  // Save config
  const handleSave = async () => {
    if (!config || saving) return

    setSaving(true)
    try {
      // 构建更新数据，如果 API Key 是 "***" 则不发送（保持后端已有的值）
      const updateData: any = {
        openaiBaseUrl: config.openaiBaseUrl,
        openaiModel: config.openaiModel,
        ragflowBaseUrl: config.ragflowBaseUrl,
        autoTagModel: config.autoTagModel,
        briefingModel: config.briefingModel,
        briefingTime: config.briefingTime,
        aiPersonality: config.aiPersonality,
        aiExpertise: config.aiExpertise ?? undefined,
        enableLinkSuggestion: config.enableLinkSuggestion,
        enableMdSync: config.enableMdSync,
        asrApiUrl: config.asrApiUrl,
      }

      // 只有在 API Key 不是遮蔽值时才发送
      if (config.openaiApiKey && config.openaiApiKey !== "***") {
        updateData.openaiApiKey = config.openaiApiKey
      }
      if (config.ragflowApiKey && config.ragflowApiKey !== "***") {
        updateData.ragflowApiKey = config.ragflowApiKey
      }
      if (config.asrApiKey && config.asrApiKey !== "***") {
        updateData.asrApiKey = config.asrApiKey
      }

      const result = await configApi.updateConfig(updateData)

      if (result.data) {
        // Update session API keys with what user just input
        const updatedSessionKeys = {
          openai: config.openaiApiKey && config.openaiApiKey !== "***" ? config.openaiApiKey : sessionApiKeys.openai,
          ragflow: config.ragflowApiKey && config.ragflowApiKey !== "***" ? config.ragflowApiKey : sessionApiKeys.ragflow,
          asr: config.asrApiKey && config.asrApiKey !== "***" ? config.asrApiKey : sessionApiKeys.asr,
        }
        setSessionApiKeys(updatedSessionKeys)

        // Save to sessionStorage for other components to access
        if (updatedSessionKeys.openai) {
          sessionStorage.setItem('openai_api_key', updatedSessionKeys.openai)
        }
        if (updatedSessionKeys.ragflow) {
          sessionStorage.setItem('ragflow_api_key', updatedSessionKeys.ragflow)
        }
        if (updatedSessionKeys.asr) {
          sessionStorage.setItem('asr_api_key', updatedSessionKeys.asr)
        }

        // 保留用户输入的敏感字段，只更新其他字段
        setConfig({
          ...result.data,
          openaiApiKey: config.openaiApiKey, // 保留用户输入
          ragflowApiKey: config.ragflowApiKey, // 保留用户输入
          asrApiKey: config.asrApiKey, // 保留用户输入
        })
        showMessage("success", "配置保存成功！更改立即生效")
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

  // Test RAGFlow connection
  const handleTestConnection = async () => {
    if (!config || testing) return

    setTesting(true)
    setTestResult(null)
    try {
      const result = await configApi.testConnection()
      setTestResult({
        success: result.success || false,
        message: result.message || result.error || "测试完成",
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: "连接测试失败",
      })
    } finally {
      setTesting(false)
    }
  }

  // Manual export to local files
  const handleExportAll = async () => {
    if (syncing) return
    setSyncing("export")
    try {
      const response = await fetch("/api/sync/export-all", { method: "POST" })
      const result = await response.json()
      if (response.ok) {
        showMessage("success", result.message || "导出成功")
      } else {
        showMessage("error", result.error || "导出失败")
      }
    } catch (error) {
      console.error("Failed to export:", error)
      showMessage("error", "导出失败")
    } finally {
      setSyncing(null)
    }
  }

  // Manual import from local files
  const handleImportAll = async () => {
    if (syncing) return
    setSyncing("import")
    try {
      const response = await fetch("/api/sync/import-all", { method: "POST" })
      const result = await response.json()
      if (response.ok) {
        showMessage("success", result.message || "导入成功")
      } else {
        showMessage("error", result.error || "导入失败")
      }
    } catch (error) {
      console.error("Failed to import:", error)
      showMessage("error", "导入失败")
    } finally {
      setSyncing(null)
    }
  }

  // Manual sync all DB content to RAGFlow
  const handleSyncAllRAGFlow = async () => {
    if (syncing) return
    setSyncing("ragflow")
    try {
      const response = await fetch("/api/sync/sync-all-ragflow", { method: "POST" })
      const result = await response.json()
      if (response.ok) {
        showMessage("success", result.message || "同步完成")
      } else {
        showMessage("error", result.error || "同步失败")
      }
    } catch (error) {
      console.error("Failed to sync to RAGFlow:", error)
      showMessage("error", "同步失败")
    } finally {
      setSyncing(null)
    }
  }

  // Show message
  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!config) {
    return <div className="p-8 text-center text-muted-foreground">加载配置失败</div>
  }

  return (
    <div className="space-y-6">
      {/* Success/Error message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* OpenAI Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">OpenAI 配置</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Base URL</label>
            <Input
              value={config.openaiBaseUrl}
              onChange={(e) =>
                setConfig({ ...config, openaiBaseUrl: e.target.value })
              }
              placeholder="http://localhost:4000"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">API Key</label>
            <Input
              type="password"
              value={sessionApiKeys.openai || (config.openaiApiKey === "***" ? "******" : "")}
              onChange={(e) => {
                setConfig({ ...config, openaiApiKey: e.target.value })
                setSessionApiKeys({ ...sessionApiKeys, openai: e.target.value })
              }}
              placeholder="sk-..."
            />
            {config.openaiApiKey === "***" && !sessionApiKeys.openai && (
              <p className="text-xs text-muted-foreground mt-1">✓ API Key 已配置</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">模型</label>
            <Input
              value={config.openaiModel}
              onChange={(e) =>
                setConfig({ ...config, openaiModel: e.target.value })
              }
              placeholder="gpt-3.5-turbo"
            />
          </div>
        </div>
      </Card>

      {/* RAGFlow Configuration */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">RAGFlow 配置</h3>
            <p className="text-xs text-muted-foreground mt-1">
              💡 提示：RAGFlow 知识库由每个工作区自动管理，无需手动配置 Chat ID 和 Dataset ID
            </p>
          </div>
          <div className="flex items-center gap-2">
            {testResult && (
              <div
                className={`flex items-center gap-1 text-sm ${
                  testResult.success
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testResult.message}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "测试连接"
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Base URL</label>
            <Input
              value={config.ragflowBaseUrl}
              onChange={(e) =>
                setConfig({ ...config, ragflowBaseUrl: e.target.value })
              }
              placeholder="http://localhost:4154"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">API Key</label>
            <Input
              type="password"
              value={sessionApiKeys.ragflow || (config.ragflowApiKey === "***" ? "******" : "")}
              onChange={(e) => {
                setConfig({ ...config, ragflowApiKey: e.target.value })
                setSessionApiKeys({ ...sessionApiKeys, ragflow: e.target.value })
              }}
              placeholder="ragflow-..."
            />
            {config.ragflowApiKey === "***" && !sessionApiKeys.ragflow && (
              <p className="text-xs text-muted-foreground mt-1">✓ API Key 已配置</p>
            )}
          </div>
        </div>
      </Card>

      {/* AI Features */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">AI 功能</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">自动 Tag 模型</label>
            <Input
              value={config.autoTagModel}
              onChange={(e) =>
                setConfig({ ...config, autoTagModel: e.target.value })
              }
              placeholder={config.openaiModel}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              留空则使用 OpenAI 配置中的模型
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">每日晨报模型</label>
            <Input
              value={config.briefingModel}
              onChange={(e) =>
                setConfig({ ...config, briefingModel: e.target.value })
              }
              placeholder={config.openaiModel}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              留空则使用 OpenAI 配置中的模型
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">每日晨报时间</label>
            <Input
              value={config.briefingTime}
              onChange={(e) =>
                setConfig({ ...config, briefingTime: e.target.value })
              }
              placeholder="08:00"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              格式：HH:MM（24小时制）
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">AI 人设</div>
              <div className="text-xs text-muted-foreground">
                选择 AI 的性格风格
              </div>
            </div>
            <select
              value={config.aiPersonality}
              onChange={(e) =>
                setConfig({ ...config, aiPersonality: e.target.value })
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="friendly">友好热情</option>
              <option value="professional">专业严谨</option>
              <option value="casual">轻松幽默</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ASR Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">语音识别 (ASR) 配置</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">API Key</label>
            <Input
              type="password"
              value={sessionApiKeys.asr || (config.asrApiKey === "***" ? "******" : "")}
              onChange={(e) => {
                setConfig({ ...config, asrApiKey: e.target.value })
                setSessionApiKeys({ ...sessionApiKeys, asr: e.target.value })
              }}
              placeholder="sk-..."
            />
            {config.asrApiKey === "***" && !sessionApiKeys.asr && (
              <p className="text-xs text-muted-foreground mt-1">✓ API Key 已配置</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">API URL</label>
            <Input
              value={config.asrApiUrl}
              onChange={(e) =>
                setConfig({ ...config, asrApiUrl: e.target.value })
              }
              placeholder="https://api.siliconflow.cn/v1/audio/transcriptions"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <p>模型固定为: TeleAI/TeleSpeechASR</p>
            <p>支持格式: wav/mp3/pcm/opus/webm</p>
          </div>
        </div>
      </Card>

      {/* MD Sync Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Markdown 同步 (Link MD)</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">启用实时同步</div>
              <div className="text-xs text-muted-foreground">
                自动同步消息和评论到 D:\Code\whitenote-data\link_md
              </div>
            </div>
            <Switch
              checked={config.enableMdSync}
              onCheckedChange={(checked) =>
                setConfig({ ...config, enableMdSync: checked })
              }
            />
          </div>
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">手动同步</div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAll}
                disabled={syncing === "export" || syncing === "import" || syncing === "ragflow"}
              >
                {syncing === "export" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4 mr-2" />
                    导出 DB → 本地
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportAll}
                disabled={syncing === "import" || syncing === "export" || syncing === "ragflow"}
              >
                {syncing === "import" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4 mr-2" />
                    导入 本地 → DB
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAllRAGFlow}
                disabled={syncing === "ragflow" || syncing === "export" || syncing === "import"}
              >
                {syncing === "ragflow" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    同步 DB → RAGFlow
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              导出：将数据库中的所有消息和评论导出为本地 MD 文件
              <br />
              导入：将本地修改过的 MD 文件导入到数据库并同步到 RAGFlow
              <br />
              同步 DB → RAGFlow：将数据库中的所有内容同步到 RAGFlow 知识库（用于迁移到新的 RAGFlow 服务器）
            </p>
          </div>
        </div>
      </Card>

      {/* Save button */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={saving}
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            保存中...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            保存配置
          </>
        )}
      </Button>
    </div>
  )
}
