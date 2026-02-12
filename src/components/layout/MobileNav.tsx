"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Hash, MessageSquare, Bookmark, Settings, PenLine, LogOut, Loader2, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, getAvatarUrl } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import { WorkspaceBreadcrumb } from "@/components/WorkspaceBreadcrumb"

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
  const [mounted, setMounted] = useState(false)
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Use session data directly
  const userName = session?.user?.name || "User Name"
  const userEmail = session?.user?.email
    ? `@${session.user.email.split("@")[0]}`
    : "@username"
  const userAvatar = getAvatarUrl(session?.user?.name || null, session?.user?.image || null) || ""
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

  // Prevent hydration mismatch by not rendering session-dependent content until mounted
  if (!mounted) {
    return null
  }

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
              </div>

              <div className="h-px bg-border mx-4" />

              <div className="p-4">
                <Button variant="ghost" asChild className="w-full justify-start gap-4 px-0 hover:bg-transparent text-xl font-bold">
                  <Link href="/settings">
                    <Settings className="h-6 w-6" />
                    设置与隐私
                  </Link>
                </Button>
              </div>

              <div className="mt-auto p-4">
                <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start gap-4 px-0 hover:bg-transparent text-xl font-bold">
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

          <Link href="/search">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Workspace Breadcrumb (Only on Home) */}
        {pathname === "/" && (
          <div className="flex w-full border-t border-border bg-background/85 backdrop-blur-md px-4 py-2 justify-center">
            <WorkspaceBreadcrumb />
          </div>
        )}

      </div>

      {/* Floating Action Button (FAB) - Only show on home page */}
      {pathname === "/" && (
        <Link
          href="/compose"
          className={cn(
            "desktop:hidden fixed bottom-[70px] right-4 z-50 transition-all duration-300",
            isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-20 scale-0 opacity-0"
          )}
        >
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white"
          >
            <PenLine className="h-6 w-6" />
          </Button>
        </Link>
      )}

      {/* Bottom Navigation Bar */}
      <div className={cn(
        "desktop:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 h-[53px] flex items-center justify-between px-4 pb-[env(safe-area-inset-bottom)] transition-transform duration-300",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}>
        <Link href="/" className="flex flex-col items-center justify-center w-full h-full">
          <MobileXHome isActive={isActive("/")} className={cn("h-7 w-7", isActive("/") && "text-foreground")} />
        </Link>

        <Link href="/tags" className="flex flex-col items-center justify-center w-full h-full">
          <XIcon icon={Hash} filled={isActive("/tags")} className={cn("h-7 w-7", isActive("/tags") && "text-foreground")} />
        </Link>

        <Link href="/aichat" className="flex flex-col items-center justify-center w-full h-full">
          <XIcon icon={MessageSquare} filled={isActive("/aichat")} className={cn("h-7 w-7", isActive("/aichat") && "text-foreground")} />
        </Link>

        <Link href="/favorites" className="flex flex-col items-center justify-center w-full h-full">
          <XIcon icon={Bookmark} filled={isActive("/favorites")} className={cn("h-7 w-7", isActive("/favorites") && "text-foreground")} />
        </Link>
      </div>
    </>
  )
}
