"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Home, Bell, Tag, Network, Settings, PenLine, MoreVertical, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function MobileNav() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY

        // Only hide if scrolled more than a threshold and not at the very top
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
          setIsVisible(false)
        } else {
          setIsVisible(true)
        }

        setLastScrollY(currentScrollY)
      }
    }

    window.addEventListener('scroll', controlNavbar)
    return () => window.removeEventListener('scroll', controlNavbar)
  }, [lastScrollY])

  const isActive = (path: string) => pathname === path

  return (
    <>
      {/* Top Navigation Bar */}
      <div className={cn(
        "desktop:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b border-border transition-transform duration-300",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}>
        {/* Main Header Row */}
        <div className="flex items-center justify-between px-4 h-[53px]">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full p-0 h-8 w-8">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <div className="p-4 space-y-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-bold text-lg leading-tight">User Name</span>
                  <span className="text-muted-foreground text-sm">@username</span>
                </div>
                <div className="flex gap-4 text-sm pt-2">
                  <span className="text-muted-foreground"><span className="font-bold text-foreground">123</span> Following</span>
                  <span className="text-muted-foreground"><span className="font-bold text-foreground">45</span> Followers</span>
                </div>
              </div>

              <nav className="mt-4 flex-1">
                <Link href="/profile" className="flex items-center gap-4 px-4 py-4 text-xl font-bold hover:bg-secondary/50 transition-colors">
                  <User className="h-6 w-6" />
                  Profile
                </Link>
                <Link href="/settings" className="flex items-center gap-4 px-4 py-4 text-xl font-bold hover:bg-secondary/50 transition-colors">
                  <Settings className="h-6 w-6" />
                  Settings
                </Link>
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="h-8 w-8 fill-foreground"
            >
              <polygon points="260.68 64.93 240.51 99.87 240.52 99.89 78.34 380.8 118.75 380.8 260.8 134.76 383.54 345.8 215.64 345.8 272.64 246.42 252.4 211.36 155.22 380.8 185.43 380.8 195.57 380.8 403.89 380.8 419.08 380.8 444.38 380.8 260.68 64.93" />
            </svg>
          </Link>

          <Button variant="ghost" size="icon" className="rounded-full">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs Row (Only on Home) */}
        {pathname === "/" && (
          <div className="flex w-full border-t border-border">
            <button className="flex-1 py-3.5 hover:bg-secondary/50 transition-colors relative flex justify-center items-center">
              <span className="font-bold text-sm">For you</span>
              <div className="absolute bottom-0 h-1 w-14 bg-primary rounded-full" />
            </button>
            <button className="flex-1 py-3.5 hover:bg-secondary/50 transition-colors flex justify-center items-center">
              <span className="font-medium text-sm text-muted-foreground">Following</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <div className={cn(
        "desktop:hidden fixed bottom-[70px] right-4 z-50 transition-all duration-300",
        isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-20 scale-0 opacity-0"
      )}>
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-[0_0_10px_rgba(29,155,240,0.5)] bg-primary hover:bg-primary/90 text-white"
        >
          <PenLine className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Navigation Bar */}
      <div className={cn(
        "desktop:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 h-[53px] flex items-center justify-between px-4 pb-[env(safe-area-inset-bottom)] transition-transform duration-300",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}>
        <Link href="/" className="flex flex-col items-center justify-center w-full h-full">
          <Home className={cn("h-7 w-7", isActive("/") ? "fill-foreground" : "text-foreground")} strokeWidth={isActive("/") ? 0 : 2} />
        </Link>

        <Link href="/notifications" className="flex flex-col items-center justify-center w-full h-full">
          <Bell className={cn("h-7 w-7", isActive("/notifications") ? "fill-foreground" : "text-foreground")} strokeWidth={isActive("/notifications") ? 0 : 2} />
        </Link>

        <Link href="/tags" className="flex flex-col items-center justify-center w-full h-full">
          <Tag className={cn("h-7 w-7", isActive("/tags") ? "fill-foreground" : "text-foreground")} strokeWidth={isActive("/tags") ? 0 : 2} />
        </Link>

        <Link href="/graph" className="flex flex-col items-center justify-center w-full h-full">
          <Network className={cn("h-7 w-7", isActive("/graph") ? "stroke-[3px]" : "text-foreground")} />
        </Link>

        <Link href="/settings" className="flex flex-col items-center justify-center w-full h-full">
          <Settings className={cn("h-7 w-7", isActive("/settings") ? "fill-foreground" : "text-foreground")} strokeWidth={isActive("/settings") ? 0 : 2} />
        </Link>
      </div>
    </>
  )
}
