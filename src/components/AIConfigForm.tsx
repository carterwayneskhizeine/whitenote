"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save, CheckCircle, XCircle } from "lucide-react"
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
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  // Session storage for user-inputted API keys (not persisted to backend as "***")
  const [sessionApiKeys, setSessionApiKeys] = useState<{ openai?: string; ragflow?: string }>({})

  // Fetch config
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

  // Save config
  const handleSave = async () => {
    if (!config || saving) return

    setSaving(true)
    try {
      const result = await configApi.updateConfig({
        openaiBaseUrl: config.openaiBaseUrl,
        openaiApiKey: config.openaiApiKey,
        openaiModel: config.openaiModel,
        enableRag: config.enableRag,
        ragflowBaseUrl: config.ragflowBaseUrl,
        ragflowApiKey: config.ragflowApiKey,
        ragflowChatId: config.ragflowChatId,
        ragflowDatasetId: config.ragflowDatasetId,
        enableAutoTag: config.enableAutoTag,
        autoTagModel: config.autoTagModel,
        enableBriefing: config.enableBriefing,
        briefingModel: config.briefingModel,
        briefingTime: config.briefingTime,
        aiPersonality: config.aiPersonality,
        aiExpertise: config.aiExpertise ?? undefined,
        enableLinkSuggestion: config.enableLinkSuggestion,
      })

      if (result.data) {
        // Update session API keys with what user just input
        setSessionApiKeys({
          openai: config.openaiApiKey && config.openaiApiKey !== "***" ? config.openaiApiKey : sessionApiKeys.openai,
          ragflow: config.ragflowApiKey && config.ragflowApiKey !== "***" ? config.ragflowApiKey : sessionApiKeys.ragflow,
        })
        // 保留用户输入的敏感字段，只更新其他字段
        setConfig({
          ...result.data,
          openaiApiKey: config.openaiApiKey, // 保留用户输入
          ragflowApiKey: config.ragflowApiKey, // 保留用户输入
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
              value={sessionApiKeys.openai || ""}
              onChange={(e) => {
                setConfig({ ...config, openaiApiKey: e.target.value })
                setSessionApiKeys({ ...sessionApiKeys, openai: e.target.value })
              }}
              placeholder={config.openaiApiKey === "***" ? "已配置 (留空保持不变)" : "sk-..."}
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
          <h3 className="text-lg font-bold">RAGFlow 配置</h3>
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
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">启用 RAG 模式</label>
            <Switch
              checked={config.enableRag}
              onCheckedChange={(checked) =>
                setConfig({ ...config, enableRag: checked })
              }
            />
          </div>
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
              value={sessionApiKeys.ragflow || ""}
              onChange={(e) => {
                setConfig({ ...config, ragflowApiKey: e.target.value })
                setSessionApiKeys({ ...sessionApiKeys, ragflow: e.target.value })
              }}
              placeholder={config.ragflowApiKey === "***" ? "已配置 (留空保持不变)" : "ragflow-..."}
            />
            {config.ragflowApiKey === "***" && !sessionApiKeys.ragflow && (
              <p className="text-xs text-muted-foreground mt-1">✓ API Key 已配置</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Chat ID</label>
            <Input
              value={config.ragflowChatId}
              onChange={(e) =>
                setConfig({ ...config, ragflowChatId: e.target.value })
              }
              placeholder="1c4db240e66011f09080b2cef1c18441"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Dataset ID</label>
            <Input
              value={config.ragflowDatasetId}
              onChange={(e) =>
                setConfig({ ...config, ragflowDatasetId: e.target.value })
              }
              placeholder="96b74969e65411f09f5fb2cef1c18441"
            />
          </div>
        </div>
      </Card>

      {/* AI Features */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">AI 功能</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">自动打标</div>
              <div className="text-xs text-muted-foreground">
                使用 AI 自动为消息添加标签
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.enableAutoTag}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableAutoTag: checked })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">每日晨报</div>
              <div className="text-xs text-muted-foreground">
                自动生成每日摘要
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.enableBriefing}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableBriefing: checked })
                }
              />
            </div>
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
