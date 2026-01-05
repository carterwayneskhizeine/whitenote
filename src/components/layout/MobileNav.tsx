"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Home as LucideHome, Bell, Tag, Network, Settings as LucideSettings, PenLine, MoreVertical, User } from "lucide-react"
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

const HomeIcon = ({ size = 24, className, strokeWidth, ...props }: any) => {
  const isFilled = className?.includes("fill-current") || className?.includes("fill-foreground");
  if (isFilled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        {...props}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10H9z"
        />
      </svg>
    );
  }
  return <LucideHome size={size} className={className} strokeWidth={strokeWidth} {...props} />;
};

const SettingsIcon = ({ size = 24, className, strokeWidth, ...props }: any) => {
  const isFilled = className?.includes("fill-current") || className?.includes("fill-foreground");
  if (isFilled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        {...props}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84a.481.481 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.487.487 0 0 0-.59.22L3.06 7.95a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.27.41.48.41h3.84c.21 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.03-1.58zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5zM12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
        />
      </svg>
    );
  }
  return <LucideSettings size={size} className={className} strokeWidth={strokeWidth} {...props} />;
};

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
                  <LucideSettings className="h-6 w-6" />
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
          <HomeIcon className={cn("h-7 w-7", isActive("/") ? "fill-foreground" : "text-foreground")} strokeWidth={isActive("/") ? 0 : 2} />
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
          <SettingsIcon className={cn("h-7 w-7", isActive("/settings") ? "fill-foreground" : "text-foreground")} strokeWidth={isActive("/settings") ? 0 : 2} />
        </Link>
      </div>
    </>
  )
}
