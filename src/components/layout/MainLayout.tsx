"use client"

import { LeftSidebar } from "./LeftSidebar"
import { RightSidebar } from "./RightSidebar"
import { MobileNav } from "./MobileNav"

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center w-full bg-background text-foreground">
      <div className="flex w-full max-w-[1300px] relative">
        <LeftSidebar />

        <main className="flex-1 border-x border-border min-h-screen flex flex-col max-w-[600px]">
          <MobileNav />
          {children}
        </main>

        <RightSidebar />
      </div>
    </div>
  )
}
