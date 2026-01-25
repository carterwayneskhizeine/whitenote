"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { 
  Moon, Sun, Monitor, Sparkles, User, Palette, Shield, Bell, 
  Globe, HelpCircle, Wand2, Layers, ChevronRight, ArrowLeft,
  FileText
} from "lucide-react"
import { AIConfigForm } from "@/components/AIConfigForm"
import { ProfileEditForm } from "@/components/ProfileEditForm"
import { PasswordChangeForm } from "@/components/PasswordChangeForm"
import { TemplateManager } from "@/components/templates/TemplateManager"
import { AICommandManager } from "@/components/ai-commands/AICommandManager"
import { WorkspaceManager } from "@/components/WorkspaceManager"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const { setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()

  // Extract current tab from URL
  const currentTab = pathname.split('/')[2] || 'profile'
  const isRootSettings = pathname === '/settings'

  // Settings navigation items
  const navItems = [
    { id: 'profile', label: '个人资料', icon: User, description: '管理您的个人资料信息' },
    { id: 'workspaces', label: '工作区管理', icon: Layers, description: '创建和管理您的工作区' },
    { id: 'ai', label: 'AI 配置', icon: Sparkles, description: '配置您的 AI 设置' },
    { id: 'ai-commands', label: 'AI 命令', icon: Wand2, description: '管理和编辑自定义 AI 命令' },
    { id: 'templates', label: '模板管理', icon: FileText, description: '管理消息模板' },
    { id: 'appearance', label: '显示与外观', icon: Palette, description: '自定义应用外观' },
    { id: 'privacy', label: '隐私与安全', icon: Shield, description: '管理隐私和安全选项' },
    { id: 'notifications', label: '通知', icon: Bell, description: '管理通知偏好' },
    { id: 'language', label: '语言', icon: Globe, description: '选择显示语言' },
    { id: 'help', label: '帮助中心', icon: HelpCircle, description: '获取帮助和支持' },
  ]

  const activeItem = navItems.find(item => item.id === currentTab) || navItems[0]

  const renderContent = () => {
    switch (currentTab) {
      case 'profile':
        return <ProfileEditForm />
      case 'workspaces':
        return <WorkspaceManager />
      case 'ai':
        return <AIConfigForm />
      case 'ai-commands':
        return <AICommandManager />
      case 'templates':
        return <TemplateManager />
      case 'appearance':
        return (
          <div className="divide-y divide-border -mx-4">
            <div className="px-4 py-6 hover:bg-muted/30 transition-colors">
              <div className="px-2 flex items-center justify-between">
                <div>
                  <p className="font-bold">深浅模式</p>
                  <p className="text-sm text-muted-foreground">选择您喜欢的界面外观</p>
                </div>
                <div className="flex bg-muted p-1 rounded-full">
                  <Button
                    variant={useTheme().theme === "light" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-full h-8 px-4"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    浅色
                  </Button>
                  <Button
                    variant={useTheme().theme === "dark" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-full h-8 px-4"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    深色
                  </Button>
                  <Button
                    variant={useTheme().theme === "system" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-full h-8 px-4"
                    onClick={() => setTheme("system")}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    系统
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      case 'privacy':
        return (
          <div className="space-y-6">
            <PasswordChangeForm />
            <div className="divide-y divide-border -mx-4 border-t border-border">
              <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
                <div className="px-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold">私密账户</p>
                    <p className="text-sm text-muted-foreground">只有您批准的关注者才能看到您的内容</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full">更改</Button>
                </div>
              </div>
              <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
                <div className="px-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold">安全登录</p>
                    <p className="text-sm text-muted-foreground">启用两步验证保护您的账户</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full">启用</Button>
                </div>
              </div>
            </div>
          </div>
        )
      case 'notifications':
        return (
          <div className="divide-y divide-border -mx-4">
            <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
              <div className="px-2 flex items-center justify-between">
                <div>
                  <p className="font-bold">推送通知</p>
                  <p className="text-sm text-muted-foreground">在设备上接收实时通知</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">管理</Button>
              </div>
            </div>
            <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
              <div className="px-2 flex items-center justify-between">
                <div>
                  <p className="font-bold">邮件通知</p>
                  <p className="text-sm text-muted-foreground">通过邮件接收摘要和动态</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">管理</Button>
              </div>
            </div>
          </div>
        )
      case 'language':
        return (
          <div className="divide-y divide-border -mx-4">
            <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
              <div className="px-2 flex items-center justify-between">
                <div>
                  <p className="font-bold">显示语言</p>
                  <p className="text-sm text-muted-foreground">当前: 简体中文</p>
                </div>
                <select className="rounded-full border border-border bg-background px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                  <option>简体中文</option>
                  <option>English</option>
                  <option>日本語</option>
                </select>
              </div>
            </div>
          </div>
        )
      case 'help':
        return (
          <div className="divide-y divide-border -mx-4">
            <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
              <div className="px-2 flex items-center justify-between">
                <div>
                  <p className="font-bold">常见问题</p>
                  <p className="text-sm text-muted-foreground">查找常见问题的解答</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">查看</Button>
              </div>
            </div>
            <div className="px-4 py-6 hover:bg-muted/30 transition-colors group">
              <div className="px-2 flex items-center justify-between">
                <div>
                  <p className="font-bold">联系我们</p>
                  <p className="text-sm text-muted-foreground">向我们发送反馈或报告问题</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">发送</Button>
              </div>
            </div>
          </div>
        )
      default:
        return <ProfileEditForm />
    }
  }

  return (
    <div className="min-h-screen bg-background flex justify-center">
      {/* 
        Mobile View 
        1. If Root (/settings): Show Menu
        2. If Sub-page (/settings/xyz): Show Content with Back Button
      */}
      <div className="w-full xl:hidden">
        {isRootSettings ? (
          // Mobile Menu
          <div className="divide-y divide-border">
            <div className="px-4 py-3 font-bold text-xl border-b border-border">
              设置
            </div>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  href={`/settings/${item.id}`}
                  className="flex items-center justify-between px-4 py-4 hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-base font-medium">{item.label}</span>
                      {/* Optional: Show description on mobile if space permits, or keep it clean like X */}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        ) : (
          // Mobile Content Page
          <div className="flex flex-col h-full">
             <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
              <div className="flex items-center h-14 px-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="mr-2"
                  onClick={() => router.push('/settings')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold leading-none">{activeItem.label}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">@{activeItem.id}</p>
                </div>
              </div>
            </div>
            <div className="p-4">
               {/* 
                 For some components that might have their own headers (like WorkspaceManager), 
                 we might want to hide the page title here or styling might duplicate.
                 However, keeping it consistent is good.
               */}
               {renderContent()}
            </div>
          </div>
        )}
      </div>

      {/* 
        Desktop View 
        Two columns: Sidebar (Nav) | Content
      */}
      <div className="hidden xl:flex w-full max-w-7xl">
        {/* Left Sidebar */}
        <div className="w-[300px] border-r border-border shrink-0">
          <div className="py-2 px-4">
            <h2 className="text-xl font-bold py-3 px-3">设置</h2>
          </div>
          <nav className="flex flex-col">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentTab === item.id
              return (
                <Link
                  key={item.id}
                  href={`/settings/${item.id}`}
                  className={cn(
                    "flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50 border-r-2",
                    isActive 
                      ? "border-primary bg-muted/30" 
                      : "border-transparent"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-muted-foreground">
                      {/* X often doesn't use icons in the detailed settings list, but keeping them for now as they are helpful */}
                      <Icon className={cn("h-6 w-6", isActive && "text-foreground")} />
                    </div>
                    <span className={cn("text-lg", isActive ? "font-bold" : "font-medium")}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight className={cn(
                    "h-5 w-5 text-muted-foreground transition-opacity",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                  )} />
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="px-6 h-14 flex items-center">
              <h2 className="text-xl font-bold">{activeItem.label}</h2>
            </div>
          </div>
          <div className="p-6 max-w-3xl">
             {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
