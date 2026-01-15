"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Loader2, Lock } from "lucide-react"
import { authApi } from "@/lib/api"

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
        // Clear form
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")

        // Clear success message after 3 seconds
        setTimeout(() => {
          setMessage(null)
        }, 3000)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          修改密码
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <label htmlFor="current-password" className="text-sm font-medium">
              当前密码
            </label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="请输入当前密码"
              required
              disabled={loading}
            />
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium">
              新密码
            </label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少 6 个字符）"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              确认新密码
            </label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              required
              disabled={loading}
            />
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "提交中..." : "确认修改"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
