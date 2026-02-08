"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save, CheckCircle, XCircle, FileDown, FileUp, Database, Sparkles, Cpu, Headphones, FileJson } from "lucide-react"
import { configApi } from "@/lib/api/config"
import { AIConfig } from "@/types/api"
import { cn } from "@/lib/utils"

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
  const [sessionApiKeys, setSessionApiKeys] = useState<{ openai?: string; ragflow?: string; asr?: string }>({})

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const result = await configApi.getConfig()
      if (result.data) {
        setConfig(result.data)
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

  const handleSave = async () => {
    if (!config || saving) return

    setSaving(true)
    try {
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
        mdSyncDir: config.mdSyncDir || null,
        asrApiUrl: config.asrApiUrl,
      }

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
        const updatedSessionKeys = {
          openai: config.openaiApiKey && config.openaiApiKey !== "***" ? config.openaiApiKey : sessionApiKeys.openai,
          ragflow: config.ragflowApiKey && config.ragflowApiKey !== "***" ? config.ragflowApiKey : sessionApiKeys.ragflow,
          asr: config.asrApiKey && config.asrApiKey !== "***" ? config.asrApiKey : sessionApiKeys.asr,
        }
        setSessionApiKeys(updatedSessionKeys)

        if (updatedSessionKeys.openai) sessionStorage.setItem('openai_api_key', updatedSessionKeys.openai)
        if (updatedSessionKeys.ragflow) sessionStorage.setItem('ragflow_api_key', updatedSessionKeys.ragflow)
        if (updatedSessionKeys.asr) sessionStorage.setItem('asr_api_key', updatedSessionKeys.asr)

        setConfig({
          ...result.data,
          openaiApiKey: config.openaiApiKey,
          ragflowApiKey: config.ragflowApiKey,
          asrApiKey: config.asrApiKey,
        })
        showMessage("success", "配置保存成功")
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
      setTestResult({ success: false, message: "连接测试失败" })
    } finally {
      setTesting(false)
    }
  }

  const handleSyncAction = async (type: "export" | "import" | "ragflow", apiPath: string) => {
    if (syncing) return
    setSyncing(type)
    try {
      const response = await fetch(apiPath, { method: "POST" })
      const result = await response.json()
      if (response.ok) {
        showMessage("success", result.message || "操作成功")
      } else {
        showMessage("error", result.error || "操作失败")
      }
    } catch (error) {
      showMessage("error", "同步请求失败")
    } finally {
      setSyncing(null)
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

  const InputRow = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
    <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
      <div className="px-2">
        <label className="text-sm font-bold text-foreground group-focus-within:text-primary transition-colors block mb-1">
          {label}
        </label>
        {children}
        {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
      </div>
    </div>
  )

  const SectionHeader = ({ icon: Icon, title, description }: { icon: any, title: string, description?: string }) => (
    <div className="px-6 py-4 bg-muted/20 border-b border-border">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  )

  return (
    <div className="divide-y divide-border -mx-4 border-t border-border">
      {/* OpenAI Section */}
      <section>
        <SectionHeader icon={Sparkles} title="OpenAI 配置" description="配置 LLM 模型基础服务" />
        <InputRow label="Base URL">
          <Input
            value={config.openaiBaseUrl}
            onChange={(e) => setConfig({ ...config, openaiBaseUrl: e.target.value })}
            placeholder="http://localhost:4000"
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
        <InputRow label="API Key">
          <Input
            type="password"
            value={sessionApiKeys.openai || (config.openaiApiKey === "***" ? "******" : "")}
            onChange={(e) => {
              setConfig({ ...config, openaiApiKey: e.target.value })
              setSessionApiKeys({ ...sessionApiKeys, openai: e.target.value })
            }}
            placeholder="sk-..."
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
        <InputRow label="默认模型">
          <Input
            value={config.openaiModel}
            onChange={(e) => setConfig({ ...config, openaiModel: e.target.value })}
            placeholder="gpt-3.5-turbo"
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
      </section>

      {/* RAGFlow Section */}
      <section>
        <div className="flex items-center justify-between px-6 py-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">RAGFlow 配置</h3>
          </div>
          <div className="flex items-center gap-3">
            {testResult && (
              <span className={cn("text-xs font-medium", testResult.success ? "text-green-600" : "text-red-600")}>
                {testResult.message}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "测试连接"}
            </Button>
          </div>
        </div>
        <InputRow label="Base URL">
          <Input
            value={config.ragflowBaseUrl}
            onChange={(e) => setConfig({ ...config, ragflowBaseUrl: e.target.value })}
            placeholder="http://localhost:4154"
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
        <InputRow label="API Key">
          <Input
            type="password"
            value={sessionApiKeys.ragflow || (config.ragflowApiKey === "***" ? "******" : "")}
            onChange={(e) => {
              setConfig({ ...config, ragflowApiKey: e.target.value })
              setSessionApiKeys({ ...sessionApiKeys, ragflow: e.target.value })
            }}
            placeholder="ragflow-..."
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
      </section>

      {/* AI Features */}
      <section>
        <SectionHeader icon={Sparkles} title="AI 功能" />
        <InputRow label="自动打标签模型" description="留空则使用默认模型">
          <Input
            value={config.autoTagModel}
            onChange={(e) => setConfig({ ...config, autoTagModel: e.target.value })}
            placeholder={config.openaiModel}
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1"
          />
        </InputRow>
        <InputRow label="每日晨报模型" description="留空则使用默认模型">
          <Input
            value={config.briefingModel}
            onChange={(e) => setConfig({ ...config, briefingModel: e.target.value })}
            placeholder={config.openaiModel}
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1"
          />
        </InputRow>
        <InputRow label="每日晨报时间" description="格式：HH:MM（24小时制）">
          <Input
            value={config.briefingTime}
            onChange={(e) => setConfig({ ...config, briefingTime: e.target.value })}
            placeholder="08:00"
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1"
          />
        </InputRow>
        <div className="px-4 py-6 hover:bg-muted/30 transition-colors">
          <div className="px-2 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold block">AI 人设</label>
              <p className="text-xs text-muted-foreground">选择 AI 的性格风格</p>
            </div>
            <select
              value={config.aiPersonality}
              onChange={(e) => setConfig({ ...config, aiPersonality: e.target.value })}
              className="rounded-full border border-border bg-background px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="friendly">友好热情</option>
              <option value="professional">专业严谨</option>
              <option value="casual">轻松幽默</option>
            </select>
          </div>
        </div>
      </section>

      {/* ASR Section */}
      <section>
        <SectionHeader icon={Headphones} title="语音识别 (ASR)" />
        <InputRow label="API URL">
          <Input
            value={config.asrApiUrl}
            onChange={(e) => setConfig({ ...config, asrApiUrl: e.target.value })}
            placeholder="https://api.siliconflow.cn/v1/audio/transcriptions"
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
        <InputRow label="API Key">
          <Input
            type="password"
            value={sessionApiKeys.asr || (config.asrApiKey === "***" ? "******" : "")}
            onChange={(e) => {
              setConfig({ ...config, asrApiKey: e.target.value })
              setSessionApiKeys({ ...sessionApiKeys, asr: e.target.value })
            }}
            placeholder="sk-..."
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
      </section>

      {/* Sync Section */}
      <section>
        <SectionHeader icon={FileJson} title="同步设置" description="本地 Markdown 同步与知识库管理" />
        <InputRow label="同步目录路径">
          <Input
            value={config.mdSyncDir ?? ""}
            onChange={(e) => setConfig({ ...config, mdSyncDir: e.target.value })}
            placeholder="D:\Code\whitenote\data\link_md"
            className="border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
          />
        </InputRow>
        <div className="px-4 py-6 hover:bg-muted/30 transition-colors">
          <div className="px-2 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold block">启用实时同步</label>
              <p className="text-xs text-muted-foreground">自动同步消息到指定目录</p>
            </div>
            <Switch
              checked={config.enableMdSync}
              onCheckedChange={(checked) => setConfig({ ...config, enableMdSync: checked })}
            />
          </div>
        </div>
        <div className="px-4 py-6">
          <div className="px-2 space-y-4">
            <label className="text-sm font-bold block">手动同步操作</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="rounded-full justify-start h-12 px-4"
                onClick={() => handleSyncAction("export", "/api/sync/export-all")}
                disabled={!!syncing}
              >
                {syncing === "export" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2 text-primary" />}
                <div className="text-left">
                  <div className="text-sm font-bold leading-none">全量导出</div>
                  <div className="text-[10px] text-muted-foreground mt-1">DB → 本地 MD</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="rounded-full justify-start h-12 px-4"
                onClick={() => handleSyncAction("import", "/api/sync/import-all")}
                disabled={!!syncing}
              >
                {syncing === "import" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2 text-primary" />}
                <div className="text-left">
                  <div className="text-sm font-bold leading-none">全量导入</div>
                  <div className="text-[10px] text-muted-foreground mt-1">本地 MD → DB</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="rounded-full justify-start h-12 px-4 col-span-full"
                onClick={() => handleSyncAction("ragflow", "/api/sync/sync-all-ragflow")}
                disabled={!!syncing}
              >
                {syncing === "ragflow" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2 text-primary" />}
                <div className="text-left">
                  <div className="text-sm font-bold leading-none">同步到 RAGFlow</div>
                  <div className="text-[10px] text-muted-foreground mt-1">重建 RAGFlow 知识库索引</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </section>

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
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "保存配置"}
          </Button>
        </div>
      </div>
    </div>
  )
}

