"use client"

import { usePathname } from "next/navigation"
import { useMobile } from "@/hooks/use-mobile"
import { LeftSidebar } from "./LeftSidebar"
import { RightSidebar } from "./RightSidebar"
import { MobileNav } from "./MobileNav"

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMobile = useMobile()
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register")
  const isSettingsPage = pathname?.startsWith("/settings")
  const isTagsPage = pathname === "/tags"

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen justify-center w-full bg-background text-foreground">
      <div className="flex w-full max-w-[1350px] justify-center relative gap-0 md:pl-10">
        {/* LeftSidebar - 层级1: 完整 (xl+), 层级2-3: 折叠 (md+), 层级4: 隐藏 (移动端) */}
        <div className="hidden xl:flex shrink-0 mr-3 -ml-17">
          <LeftSidebar />
        </div>
        <div className="hidden md:flex xl:hidden shrink-0">
          <LeftSidebar collapsed />
        </div>

        {/* MainLayout - 移动端全宽,桌面端 max-w-[600px] */}
        <main className={`flex-1 min-h-screen flex flex-col w-full ${!isMobile ? 'border-x border-border' : ''} ${isSettingsPage ? 'md:max-w-[600px] xl:max-w-[1000px]' :
          isTagsPage ? 'max-w-full' :
            'md:max-w-[600px]'
          } shrink-0`}>
          <MobileNav />
          {children}
        </main>

        {/* RightSidebar - 层级1-2: 显示 (lg+), 层级3-4: 隐藏, hidden on settings and tags page */}
        {!isSettingsPage && !isTagsPage && (
          <div className="hidden lg:flex shrink-0 ml-3.75">
            <RightSidebar />
          </div>
        )}
      </div>
    </div>
  )

}
