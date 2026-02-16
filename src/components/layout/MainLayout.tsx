"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { LeftSidebar } from "./LeftSidebar"
import { RightSidebar } from "./RightSidebar"
import { MobileNav } from "./MobileNav"
import { WorkspaceBreadcrumb } from "@/components/WorkspaceBreadcrumb"
import { useRouter } from "next/navigation"

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR or before mount, render a simplified version
  if (!mounted) {
    return (
      <div className="flex min-h-screen justify-center w-full bg-background text-foreground">
        <div className="flex w-full max-w-[1350px] justify-center relative gap-0 md:pl-10">
          <main className="flex-1 min-h-screen flex flex-col w-full md:max-w-[600px] shrink-0">
            <MobileNav disableAutoHide={pathname === "/aichat"} />
            {children}
          </main>
        </div>
      </div>
    )
  }

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register")
  const isSettingsPage = pathname?.startsWith("/settings")
  const isTagsPage = pathname === "/tags"
  const isAIChatPage = pathname === "/aichat"
  const isHomePage = pathname === "/"

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen justify-center w-full bg-background text-foreground" suppressHydrationWarning>
      <div className="flex w-full max-w-[1350px] justify-center relative gap-0 md:pl-10">
        {/* LeftSidebar - 层级1: 完整 (xl+), 层级2-3: 折叠 (md+), 层级4: 隐藏 (移动端) */}
        <div className="hidden xl:flex shrink-0 mr-3 -ml-17 h-screen sticky top-0">
          <LeftSidebar />
        </div>
        <div className="hidden md:flex xl:hidden shrink-0 h-screen sticky top-0">
          <LeftSidebar collapsed />
        </div>

        {/* MainLayout - 移动端全宽,桌面端 max-w-[600px] */}
        <main className={`flex-1 min-h-screen flex flex-col w-full min-w-0 overflow-visible md:border-x md:border-border ${isSettingsPage ? 'md:max-w-[600px] xl:max-w-[1000px]' :
          isTagsPage ? 'max-w-full' :
            'md:max-w-[600px]'
          } shrink-0`}>
          <MobileNav disableAutoHide={isAIChatPage} />
          {/* Desktop Workspace Breadcrumb - Only show on home page, sticky at top */}
          {isHomePage && (
            <div className="hidden md:block sticky top-0 z-10 bg-background border-b border-border">
              <div className="px-4 h-12 flex items-center justify-center">
                <WorkspaceBreadcrumb
                  onWorkspaceChange={() => router.refresh()}
                />
              </div>
            </div>
          )}
          {children}
        </main>

        {/* RightSidebar - 层级1-2: 显示 (lg+), 层级3-4: 隐藏, hidden on settings and tags page */}
        {!isSettingsPage && !isTagsPage && (
          <div className="hidden lg:flex shrink-0 ml-3.75 h-screen sticky top-0">
            <RightSidebar />
          </div>
        )}
      </div>
    </div>
  )

}
