"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Hash, Bell, Bookmark, List, Settings, PenLine, LogOut } from "lucide-react"
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
import { authApi } from "@/lib/api"

// Helper for X-style icons
const XIcon = ({ icon: Icon, filled, size = 26, className }: any) => (
  <Icon
    size={size}
    className={cn(className)}
    fill={filled ? "currentColor" : "none"}
    strokeWidth={filled ? 2.5 : 2}
  />
)

const MobileXHome = ({ isActive, className }: any) => {
  const solidPath = "M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913v-7.075h3.008v7.075c0 .502.418.913.929.913h6.639c.51 0 .928-.41.928-.913V7.904c0-.301-.158-.584-.408-.758z"
  const outlinePath = "M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913v-7.075h3.008v7.075c0 .502.418.913.929.913h6.639c.51 0 .928-.41.928-.913V7.904c0-.301-.158-.584-.408-.758zM20 20l-4.5.01.011-7.097c0-.502-.418-.913-.928-.913H9.44c-.511 0-.929.41-.929.913L8.5 20H4V8.773l8.011-5.342L20 8.764z"

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <g>
        <path d={isActive ? solidPath : outlinePath}></path>
      </g>
    </svg>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [userData, setUserData] = useState<{ name: string; email: string; avatar: string } | null>(null)

  // Fetch fresh user data from API
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const result = await authApi.getCurrentUser()
        if (result.data) {
          setUserData({
            name: result.data.name || "User Name",
            email: result.data.email || "",
            avatar: result.data.avatar || ""
          })
        }
      } catch (error) {
        // 401 错误会触发自动跳转到登录页，不需要额外处理
        // 其他错误静默处理，避免控制台错误
        if (error?.message !== 'Unauthorized') {
          console.error('Failed to load user data:', error)
        }
      }
    }
    loadUserData()
  }, [])

  // Use API data if available, otherwise fall back to session
  const userName = userData?.name || session?.user?.name || "User Name"
  const userEmail = userData?.email
    ? `@${userData.email.split("@")[0]}`
    : session?.user?.email
      ? `@${session.user.email.split("@")[0]}`
      : "@username"
  const userAvatar = userData?.avatar || session?.user?.image || ""
  const userInitials = userName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "CN"

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

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
        "desktop:hidden fixed top-0 left-0 right-0 z-40 bg-background/85 backdrop-blur-md border-b border-border transition-transform duration-300",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}>
        {/* Main Header Row */}
        <div className="flex items-center justify-between px-4 h-[53px]">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full p-0 h-8 w-8">
                <Avatar className="h-8 w-8">
                  {userAvatar && <AvatarImage src={userAvatar} className="object-cover" />}
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-background">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>

              {/* Drawer Header */}
              <div className="p-4 flex flex-col gap-3">
                <Avatar className="h-10 w-10">
                  {userAvatar && <AvatarImage src={userAvatar} className="object-cover" />}
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-bold text-lg leading-tight">{userName}</span>
                  <span className="text-muted-foreground text-sm">{userEmail}</span>
                </div>
                <div className="flex gap-4 text-sm pt-1">
                  <span className="text-muted-foreground"><span className="font-bold text-foreground">123</span> Following</span>
                  <span className="text-muted-foreground"><span className="font-bold text-foreground">45</span> Followers</span>
                </div>
              </div>

              <div className="h-px bg-border mx-4" />

              <nav className="flex-1 overflow-y-auto py-2">
                <Link href="/favorites" className="flex items-center gap-4 px-4 py-3 text-xl font-bold hover:bg-secondary/50 transition-colors">
                  <Bookmark className="h-6 w-6" />
                  收藏
                </Link>
                <Link href="/lists" className="flex items-center gap-4 px-4 py-3 text-xl font-bold hover:bg-secondary/50 transition-colors">
                  <List className="h-6 w-6" />
                  列表
                </Link>
                <Link href="/settings" className="flex items-center gap-4 px-4 py-3 text-xl font-bold hover:bg-secondary/50 transition-colors">
                  <Settings className="h-6 w-6" />
                  设置与隐私
                </Link>
              </nav>

              <div className="h-px bg-border mx-4" />

              <div className="p-4">
                <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start gap-4 px-0 hover:bg-transparent text-xl font-bold text-red-500">
                  <LogOut className="h-6 w-6" />
                  退出登录
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="h-7 w-7 fill-foreground"
            >
              <polygon points="260.68 64.93 240.51 99.87 240.52 99.89 78.34 380.8 118.75 380.8 260.8 134.76 383.54 345.8 215.64 345.8 272.64 246.42 252.4 211.36 155.22 380.8 185.43 380.8 195.57 380.8 403.89 380.8 419.08 380.8 444.38 380.8 260.68 64.93" />
            </svg>
          </Link>

          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Tabs Row (Only on Home) */}
        {pathname === "/" && (
          <div className="flex w-full border-t border-border bg-background/85 backdrop-blur-md">
            <button className="flex-1 py-3 hover:bg-secondary/50 transition-colors relative flex justify-center items-center">
              <span className="font-bold text-sm">推荐</span>
              <div className="absolute bottom-0 h-1 w-10 bg-primary rounded-full" />
            </button>
            <button className="flex-1 py-3 hover:bg-secondary/50 transition-colors flex justify-center items-center">
              <span className="font-bold text-sm text-muted-foreground">关注</span>
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
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white"
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
          <MobileXHome isActive={isActive("/")} className={cn("h-7 w-7", isActive("/") && "text-white")} />
        </Link>

        <Link href="/tags" className="flex flex-col items-center justify-center w-full h-full">
          <XIcon icon={Hash} filled={isActive("/tags")} className={cn("h-7 w-7", isActive("/tags") && "text-white")} />
        </Link>

        <Link href="/notifications" className="flex flex-col items-center justify-center w-full h-full">
          <XIcon icon={Bell} filled={isActive("/notifications")} className={cn("h-7 w-7", isActive("/notifications") && "text-white")} />
        </Link>

        <Link href="/favorites" className="flex flex-col items-center justify-center w-full h-full">
          <XIcon icon={Bookmark} filled={isActive("/favorites")} className={cn("h-7 w-7", isActive("/favorites") && "text-white")} />
        </Link>
      </div>
    </>
  )
}
