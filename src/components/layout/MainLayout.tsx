"use client"

import { LeftSidebar } from "./LeftSidebar"
import { RightSidebar } from "./RightSidebar"
import { MobileNav } from "./MobileNav"

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center w-full bg-background text-foreground">
      <div className="flex w-full max-w-[1300px] justify-center relative gap-0">
        {/* LeftSidebar - 层级1: 完整 (xl+), 层级2-3: 折叠 (md+), 层级4: 隐藏 (移动端) */}
        <div className="hidden xl:flex shrink-0 mr-7">
          <LeftSidebar />
        </div>
        <div className="hidden md:flex xl:hidden shrink-0">
          <LeftSidebar collapsed />
        </div>

        {/* MainLayout - 始终保持 max-w-[600px] */}
        <main className="flex-1 border-x border-border min-h-screen flex flex-col max-w-[600px] shrink-0">
          <MobileNav />
          {children}
        </main>

        {/* RightSidebar - 层级1-2: 显示 (lg+), 层级3-4: 隐藏 */}
        <div className="hidden lg:flex shrink-0 ml-3.75">
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}
