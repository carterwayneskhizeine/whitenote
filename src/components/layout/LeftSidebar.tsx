"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home, Bell, Tag, Network, Settings,
  MoreHorizontal, PenLine
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface LeftSidebarProps {
  isMobile?: boolean
  collapsed?: boolean
}

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Tag, label: "Tags", href: "/tags" },
  { icon: Network, label: "Graph", href: "/graph" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function LeftSidebar({ isMobile, collapsed }: LeftSidebarProps) {
  const pathname = usePathname()

  const UserInfo = () => (
    <div className="flex flex-col px-4 py-2 gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src="https://github.com/shadcn.png" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="font-bold text-base leading-tight">User Name</span>
        <span className="text-muted-foreground text-sm">@username</span>
      </div>
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground"><span className="font-bold text-foreground">123</span> Following</span>
        <span className="text-muted-foreground"><span className="font-bold text-foreground">45</span> Followers</span>
      </div>
    </div>
  )

  return (
    <aside className={cn(
      "sticky top-0 h-screen flex flex-col justify-between px-2 py-2",
      isMobile ? "w-full overflow-y-auto bg-black" :
        collapsed ? "w-[88px]" :
          "w-[275px]"
    )}>
      <div className="flex flex-col gap-2">
        {/* Mobile Header */}
        {isMobile && <UserInfo />}

        {/* Logo (Desktop only here, MobileNav has its own) */}
        {!isMobile && !collapsed && (
          <Link href="/" className="flex items-center gap-2 px-4 py-2 w-min hover:bg-secondary/50 rounded-full transition-colors mb-1">
            <div className="h-10 w-10 bg-foreground rounded-full" />
          </Link>
        )}

        {/* Logo for collapsed mode */}
        {!isMobile && collapsed && (
          <Link href="/" className="flex items-center justify-center w-14 h-14 hover:bg-secondary/50 rounded-full transition-colors mb-1 mx-auto">
            <div className="h-10 w-10 bg-foreground rounded-full" />
          </Link>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const isHome = item.label === "Home"
            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "justify-start h-14 rounded-full hover:bg-secondary/50 transition-colors",
                  collapsed ? "w-14 px-0 mx-auto" : "gap-5 text-xl px-4 w-min lg:w-full",
                  isActive && "font-bold",
                  isMobile && "w-full text-lg"
                )}
                asChild
              >
                <Link href={item.href} className={cn("flex items-center", collapsed && "justify-center")}>
                  <item.icon
                    size={25}
                    className={cn("shrink-0", isActive && "fill-current")}
                    strokeWidth={isActive ? 3 : 2}
                    style={{ width: '25px', height: '25px', minWidth: '25px', minHeight: '25px' }}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </Button>
            )
          })}
        </nav>

        {!isMobile && !collapsed && (
          <Button size="lg" className="mt-4 rounded-full font-bold text-lg h-14 w-[90%] mx-auto bg-foreground hover:bg-foreground/90 text-background shadow-lg lg:w-full">
            <span>Post</span>
          </Button>
        )}

        {/* Collapsed Post button */}
        {!isMobile && collapsed && (
          <Button size="icon" className="mt-4 rounded-full h-14 w-14 mx-auto bg-foreground hover:bg-foreground/90 text-background shadow-lg">
            <PenLine size={40} strokeWidth={2.5} />
          </Button>
        )}
      </div>

      {/* Desktop User Profile at bottom */}
      {!isMobile && !collapsed && (
        <div className="mt-auto mb-4">
          <Button variant="ghost" className="w-full justify-between h-16 rounded-full px-4 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start text-sm">
                <span className="font-bold">User Name</span>
                <span className="text-muted-foreground">@username</span>
              </div>
            </div>
            <MoreHorizontal className="h-5 w-5 hidden lg:block" />
          </Button>
        </div>
      )}

      {/* Collapsed user avatar */}
      {!isMobile && collapsed && (
        <div className="mt-auto mb-4">
          <Button variant="ghost" className="w-14 h-14 justify-center rounded-full px-0 hover:bg-secondary/50 transition-colors mx-auto">
            <Avatar className="h-10 w-10">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </Button>
        </div>
      )}
    </aside>
  )
}
