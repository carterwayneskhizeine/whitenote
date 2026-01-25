"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Lock, ShieldCheck } from "lucide-react"
import { authApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export function PasswordChangeForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Validation
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "新密码至少需要 6 个字符" })
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "两次输入的新密码不一致" })
      setLoading(false)
      return
    }

    if (currentPassword === newPassword) {
      setMessage({ type: "error", text: "新密码不能与当前密码相同" })
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "密码修改失败" })
      } else {
        setMessage({ type: "success", text: "密码修改成功" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (error) {
      console.error("Change password error:", error)
      setMessage({ type: "error", text: "网络错误，请稍后重试" })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setMessage(null)
  }

  const InputRow = ({ label, id, value, onChange, placeholder }: any) => (
    <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
      <div className="px-2 space-y-2">
        <label htmlFor={id} className="text-sm font-bold text-foreground group-focus-within:text-primary transition-colors">
          {label}
        </label>
        <Input
          id={id}
          type="password"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          disabled={loading}
          className="border-transparent bg-transparent px-0 text-lg focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1"
        />
      </div>
    </div>
  )

  return (
    <div className="divide-y divide-border -mx-4 border-t border-border">
      <div className="px-6 py-4 bg-muted/20 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">修改密码</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">定期更换密码以保护您的账户安全</p>
      </div>

      <form onSubmit={handleSubmit}>
        <InputRow 
          label="当前密码" 
          id="current-password" 
          value={currentPassword} 
          onChange={(e: any) => setCurrentPassword(e.target.value)} 
          placeholder="请输入当前密码" 
        />
        <InputRow 
          label="新密码" 
          id="new-password" 
          value={newPassword} 
          onChange={(e: any) => setNewPassword(e.target.value)} 
          placeholder="至少 6 个字符" 
        />
        <InputRow 
          label="确认新密码" 
          id="confirm-password" 
          value={confirmPassword} 
          onChange={(e: any) => setConfirmPassword(e.target.value)} 
          placeholder="再次输入新密码" 
        />

        <div className="px-4 py-8 space-y-6">
          {message && (
            <div
              className={cn(
                "p-4 rounded-xl text-sm font-medium mx-2 transition-all animate-in fade-in slide-in-from-top-2",
                message.type === "success"
                  ? "bg-green-500/10 text-green-600 border border-green-500/20"
                  : "bg-red-500/10 text-red-600 border border-red-500/20"
              )}
            >
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-3 px-2">
            <Button 
              type="submit" 
              disabled={loading} 
              className="rounded-full px-8 font-bold bg-foreground text-background hover:bg-foreground/90 transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "更新密码"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-8 font-bold"
              onClick={handleCancel}
              disabled={loading}
            >
              取消
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
