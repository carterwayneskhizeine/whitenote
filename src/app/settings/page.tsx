"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Moon, Sun, Monitor, Sparkles, User, Palette, Shield, Bell, Globe, HelpCircle, Wand2, Layers } from "lucide-react"
import { AIConfigForm } from "@/components/AIConfigForm"
import { ProfileEditForm } from "@/components/ProfileEditForm"
import { PasswordChangeForm } from "@/components/PasswordChangeForm"
import { TemplateManager } from "@/components/templates/TemplateManager"
import { AICommandManager } from "@/components/ai-commands/AICommandManager"
import { WorkspaceManager } from "@/components/WorkspaceManager"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { FileText } from "lucide-react"

export default function SettingsPage() {
  const { setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()

  // Extract current tab from URL
  const currentTab = pathname.split('/')[2] || 'profile'

  // Settings navigation items
  const navItems = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'workspaces', label: '工作区管理', icon: Layers },
    { id: 'ai', label: 'AI 配置', icon: Sparkles },
    { id: 'ai-commands', label: 'AI 命令', icon: Wand2 },
    { id: 'templates', label: '模板管理', icon: FileText },
    { id: 'appearance', label: '显示与外观', icon: Palette },
    { id: 'privacy', label: '隐私与安全', icon: Shield },
    { id: 'notifications', label: '通知', icon: Bell },
    { id: 'language', label: '语言', icon: Globe },
    { id: 'help', label: '帮助中心', icon: HelpCircle },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile View - Tabs at top, content below */}
      <div className="xl:hidden">
        {/* Mobile Tabs */}
        <div className="border-b border-border bg-background sticky top-0 z-50">
          <div className="flex overflow-x-auto hide-scrollbar py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentTab === item.id
              return (
                <Link
                  key={item.id}
                  href={`/settings/${item.id}`}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap ${
                    isActive
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Mobile Content */}
        <div className="px-4 py-6">
          {/* Profile Tab */}
          {currentTab === 'profile' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">个人资料</h2>
                <p className="text-muted-foreground">管理您的个人资料信息</p>
              </div>
              <ProfileEditForm />
            </div>
          )}

          {/* Workspaces Tab */}
          {currentTab === 'workspaces' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">工作区管理</h2>
                <p className="text-muted-foreground">创建和管理您的工作区，每个工作区有独立的知识库和设置</p>
              </div>
              <WorkspaceManager />
            </div>
          )}

          {/* AI Configuration Tab */}
          {currentTab === 'ai' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">AI 配置</h2>
                <p className="text-muted-foreground">配置您的 AI 设置</p>
              </div>
              <AIConfigForm />
            </div>
          )}

          {/* Templates Tab */}
          {currentTab === 'templates' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">模板管理</h2>
                <p className="text-muted-foreground">管理和编辑您的消息模板</p>
              </div>
              <TemplateManager />
            </div>
          )}

          {/* AI Commands Tab */}
          {currentTab === 'ai-commands' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">AI 命令</h2>
                <p className="text-muted-foreground">管理和编辑您的自定义 AI 命令</p>
              </div>
              <AICommandManager />
            </div>
          )}

          {/* Appearance Tab */}
          {currentTab === 'appearance' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">显示与外观</h2>
                <p className="text-muted-foreground">自定义应用外观</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>主题</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">颜色主题</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTheme("light")}
                        title="浅色"
                      >
                        <Sun className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTheme("dark")}
                        title="深色"
                      >
                        <Moon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTheme("system")}
                        title="跟随系统"
                      >
                        <Monitor className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Additional tabs can be added here */}
          {currentTab === 'privacy' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">隐私与安全</h2>
                <p className="text-muted-foreground">管理您的隐私设置和安全选项</p>
              </div>
              <div className="space-y-6">
                <PasswordChangeForm />
                <Card>
                  <CardHeader>
                    <CardTitle>隐私设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">私密账户</p>
                        <p className="text-sm text-muted-foreground">只有您批准的关注者才能看到您的内容</p>
                      </div>
                      <Button variant="outline" size="sm">更改</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">安全登录</p>
                        <p className="text-sm text-muted-foreground">启用两步验证保护您的账户</p>
                      </div>
                      <Button variant="outline" size="sm">启用</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {currentTab === 'notifications' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">通知</h2>
                <p className="text-muted-foreground">管理您收到的通知</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>通知设置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">推送通知</p>
                      <p className="text-sm text-muted-foreground">在设备上接收通知</p>
                    </div>
                    <Button variant="outline" size="sm">管理</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">邮件通知</p>
                      <p className="text-sm text-muted-foreground">通过邮件接收摘要</p>
                    </div>
                    <Button variant="outline" size="sm">管理</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentTab === 'language' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">语言</h2>
                <p className="text-muted-foreground">选择应用显示的语言</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>语言偏好</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">显示语言</p>
                      <p className="text-sm text-muted-foreground">当前: 简体中文</p>
                    </div>
                    <select className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>简体中文</option>
                      <option>English</option>
                      <option>日本語</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentTab === 'help' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">帮助中心</h2>
                <p className="text-muted-foreground">获取帮助和支持</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>帮助选项</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">常见问题</p>
                      <p className="text-sm text-muted-foreground">查找常见问题的解答</p>
                    </div>
                    <Button variant="outline" size="sm">查看</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">联系我们</p>
                      <p className="text-sm text-muted-foreground">向我们发送反馈或报告问题</p>
                    </div>
                    <Button variant="outline" size="sm">发送</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Desktop View - Sidebar + Content */}
      <div className="hidden xl:block">
        <div className="max-w-6xl mx-auto flex">
          {/* Left Navigation Sidebar */}
          <div className="w-64 border-r border-border py-4 pr-4">
            <h1 className="text-xl font-bold mb-6 px-4">设置</h1>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = currentTab === item.id
                return (
                  <Link
                    key={item.id}
                    href={`/settings/${item.id}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-none text-base font-bold transition-colors ${
                      isActive
                        ? 'bg-accent text-foreground'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="max-w-2xl mx-auto px-4 py-6">
              {/* Profile Tab */}
              {currentTab === 'profile' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">个人资料</h2>
                    <p className="text-muted-foreground">管理您的个人资料信息</p>
                  </div>
                  <ProfileEditForm />
                </div>
              )}

              {/* Workspaces Tab */}
              {currentTab === 'workspaces' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">工作区管理</h2>
                    <p className="text-muted-foreground">创建和管理您的工作区，每个工作区有独立的知识库和设置</p>
                  </div>
                  <WorkspaceManager />
                </div>
              )}

              {/* AI Configuration Tab */}
              {currentTab === 'ai' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">AI 配置</h2>
                    <p className="text-muted-foreground">配置您的 AI 设置</p>
                  </div>
                  <AIConfigForm />
                </div>
              )}

              {/* Templates Tab */}
              {currentTab === 'templates' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">模板管理</h2>
                    <p className="text-muted-foreground">管理和编辑您的消息模板</p>
                  </div>
                  <TemplateManager />
                </div>
              )}

              {/* AI Commands Tab */}
              {currentTab === 'ai-commands' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">AI 命令</h2>
                    <p className="text-muted-foreground">管理和编辑您的自定义 AI 命令</p>
                  </div>
                  <AICommandManager />
                </div>
              )}

              {/* Appearance Tab */}
              {currentTab === 'appearance' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">显示与外观</h2>
                    <p className="text-muted-foreground">自定义应用外观</p>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>主题</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">颜色主题</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setTheme("light")}
                            title="浅色"
                          >
                            <Sun className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setTheme("dark")}
                            title="深色"
                          >
                            <Moon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setTheme("system")}
                            title="跟随系统"
                          >
                            <Monitor className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Additional tabs can be added here */}
              {currentTab === 'privacy' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">隐私与安全</h2>
                    <p className="text-muted-foreground">管理您的隐私设置和安全选项</p>
                  </div>
                  <div className="space-y-6">
                    <PasswordChangeForm />
                    <Card>
                      <CardHeader>
                        <CardTitle>隐私设置</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">私密账户</p>
                            <p className="text-sm text-muted-foreground">只有您批准的关注者才能看到您的内容</p>
                          </div>
                          <Button variant="outline" size="sm">更改</Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">安全登录</p>
                            <p className="text-sm text-muted-foreground">启用两步验证保护您的账户</p>
                          </div>
                          <Button variant="outline" size="sm">启用</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {currentTab === 'notifications' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">通知</h2>
                    <p className="text-muted-foreground">管理您收到的通知</p>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>通知设置</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">推送通知</p>
                          <p className="text-sm text-muted-foreground">在设备上接收通知</p>
                        </div>
                        <Button variant="outline" size="sm">管理</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">邮件通知</p>
                          <p className="text-sm text-muted-foreground">通过邮件接收摘要</p>
                        </div>
                        <Button variant="outline" size="sm">管理</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {currentTab === 'language' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">语言</h2>
                    <p className="text-muted-foreground">选择应用显示的语言</p>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>语言偏好</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">显示语言</p>
                          <p className="text-sm text-muted-foreground">当前: 简体中文</p>
                        </div>
                        <select className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option>简体中文</option>
                          <option>English</option>
                          <option>日本語</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {currentTab === 'help' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">帮助中心</h2>
                    <p className="text-muted-foreground">获取帮助和支持</p>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>帮助选项</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">常见问题</p>
                          <p className="text-sm text-muted-foreground">查找常见问题的解答</p>
                        </div>
                        <Button variant="outline" size="sm">查看</Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">联系我们</p>
                          <p className="text-sm text-muted-foreground">向我们发送反馈或报告问题</p>
                        </div>
                        <Button variant="outline" size="sm">发送</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
