"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { authApi } from "@/lib/api"
import { Loader2 } from "lucide-react"

export function ProfileEditForm() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [initializing, setInitializing] = useState(true)

  // Form state
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState("")

  // Initialize form with current user data
  useEffect(() => {
    const loadUserData = async () => {
      // First try to get from API for fresh data
      const result = await authApi.getCurrentUser()
      if (result.data) {
        setName(result.data.name || "")
        setAvatar(result.data.avatar || "")
      } else if (session?.user) {
        // Fallback to session data
        setName(session.user.name || "")
        setAvatar(session.user.image || "")
      }
      setInitializing(false)
    }

    loadUserData()
  }, [session])

  const userInitials = name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "CN"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const updateData: { name?: string; avatar?: string } = {}
    const newName = name.trim()
    const newAvatar = avatar.trim()

    // Always send the data to backend for comparison
    if (newName) {
      updateData.name = newName
    }

    // Send avatar even if empty (to clear it)
    updateData.avatar = newAvatar

    const result = await authApi.updateProfile(updateData)

    if (result.error) {
      setMessage({ type: "error", text: result.error })
      setLoading(false)
    } else {
      setMessage({ type: "success", text: "资料更新成功" })

      // Update the form state with the new values
      setName(result.data?.name || newName)
      setAvatar(result.data?.avatar || newAvatar)

      // Update NextAuth session
      await update({
        ...session,
        user: {
          ...session?.user,
          name: result.data?.name || newName,
          image: result.data?.avatar || newAvatar || null,
        },
      })

      setLoading(false)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null)
      }, 3000)
    }
  }

  const handleCancel = async () => {
    // Reload from API
    const result = await authApi.getCurrentUser()
    if (result.data) {
      setName(result.data.name || "")
      setAvatar(result.data.avatar || "")
    }
    setMessage(null)
  }

  if (initializing) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar Preview */}
      <Card>
        <CardHeader>
          <CardTitle>头像预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {avatar && <AvatarImage src={avatar} className="object-cover" />}
              <AvatarFallback className="text-2xl">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                头像会显示在你的个人资料和消息旁边
              </p>
              <p className="text-xs text-muted-foreground">
                支持 URL 链接或使用默认头像
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Name Field */}
      <Card>
        <CardHeader>
          <CardTitle>昵称</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入你的昵称"
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            这将是你显示在应用中的名称
          </p>
        </CardContent>
      </Card>

      {/* Avatar URL Field */}
      <Card>
        <CardHeader>
          <CardTitle>头像链接</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            输入图片 URL 作为你的头像
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=" + name)}
            >
              随机生成头像
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAvatar("")}
            >
              使用默认头像
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-900/20 border border-green-800 text-green-400"
              : "bg-red-900/20 border border-red-800 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading} className="min-w-30">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中
            </>
          ) : (
            "保存更改"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={loading}
        >
          取消
        </Button>
      </div>
    </form>
  )
}
