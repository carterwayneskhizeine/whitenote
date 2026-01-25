"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { authApi } from "@/lib/api"
import { Loader2, Upload, Trash2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export function ProfileEditForm() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [initializing, setInitializing] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState("")

  // Initialize form with current user data
  useEffect(() => {
    const loadUserData = async () => {
      const result = await authApi.getCurrentUser()
      if (result.data) {
        setName(result.data.name || "")
        setAvatar(result.data.avatar || "")
      } else if (session?.user) {
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

    if (newName) updateData.name = newName
    updateData.avatar = newAvatar

    const result = await authApi.updateProfile(updateData)

    if (result.error) {
      setMessage({ type: "error", text: result.error })
      setLoading(false)
    } else {
      setMessage({ type: "success", text: "资料更新成功" })
      setName(result.data?.name || newName)
      setAvatar(result.data?.avatar || newAvatar)

      await update({
        ...session,
        user: {
          ...session?.user,
          name: result.data?.name || newName,
          image: result.data?.avatar || newAvatar || null,
        },
      })

      setLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleCancel = async () => {
    const result = await authApi.getCurrentUser()
    if (result.data) {
      setName(result.data.name || "")
      setAvatar(result.data.avatar || "")
    }
    setMessage(null)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: "error", text: "只支持 JPG、PNG、WebP、GIF 格式的图片" })
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setMessage({ type: "error", text: "图片大小不能超过 5MB" })
      return
    }

    setUploading(true)
    setMessage(null)

    const result = await authApi.uploadAvatar(file)

    if (result.error) {
      setMessage({ type: "error", text: result.error })
      setUploading(false)
    } else if (result.data?.url) {
      setAvatar(result.data.url)
      setMessage({ type: "success", text: "图片上传成功" })
      setUploading(false)
      setTimeout(() => setMessage(null), 3000)
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="divide-y divide-border -mx-4">
      {/* Avatar Section */}
      <div className="px-4 py-6">
        <h3 className="text-xl font-bold mb-4 px-2">修改个人头像</h3>
        <div className="flex items-center gap-6 px-2">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-border ring-offset-2 ring-primary transition-all group-hover:ring-2">
              {avatar && <AvatarImage src={avatar} className="object-cover" />}
              <AvatarFallback className="text-3xl font-bold">{userInitials}</AvatarFallback>
            </Avatar>
            <div 
              className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "上传新图片"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-destructive hover:bg-destructive/10"
                onClick={() => setAvatar("")}
              >
                移除头像
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              推荐使用正方形图片，支持 JPG、PNG、GIF。
            </p>
          </div>
        </div>
      </div>

      {/* Name Section */}
      <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
        <div className="px-2 space-y-4">
          <div className="flex flex-col">
            <label className="text-sm font-bold mb-1 text-foreground group-focus-within:text-primary transition-colors">
              昵称
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入你的昵称"
              className="max-w-md border-transparent bg-transparent px-0 text-lg focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            这是你在应用中显示的公开名称。
          </p>
        </div>
      </div>

      {/* Avatar URL Section */}
      <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
        <div className="px-2 space-y-4">
          <div className="flex flex-col">
            <label className="text-sm font-bold mb-1 text-foreground group-focus-within:text-primary transition-colors">
              头像链接
            </label>
            <Input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full max-w-2xl border-transparent bg-transparent px-0 text-base focus-visible:ring-0 rounded-none border-b focus-visible:border-primary transition-all h-auto py-1 font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=" + (name || Date.now().toString()))}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              随机生成
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => setAvatar("")}
            >
              使用默认
            </Button>
          </div>
        </div>
      </div>

      {/* Message & Actions */}
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
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "保存"
            )}
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
  )
}

