"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState } from "react"
import {
  Home as LucideHome, Bell, Tag, Network, Settings as LucideSettings,
  MoreHorizontal, PenLine, LogOut
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface LeftSidebarProps {
  isMobile?: boolean
  collapsed?: boolean
}

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

const navItems = [
  { icon: HomeIcon, label: "Home", href: "/" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Tag, label: "Tags", href: "/tags" },
  { icon: Network, label: "Graph", href: "/graph" },
  { icon: SettingsIcon, label: "Settings", href: "/settings" },
]

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

export function LeftSidebar({ isMobile, collapsed }: LeftSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

  const user = session?.user
  const userName = user?.name || "User Name"
  const userEmail = user?.email ? `@${user.email.split("@")[0]}` : "@username"
  const userAvatar = user?.image || "https://github.com/shadcn.png"
  const userInitials = userName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "CN"

  return (
    <aside className={cn(
      "sticky top-0 h-screen flex flex-col justify-between py-2",
      isMobile ? "w-full overflow-y-auto bg-black px-2" :
        collapsed ? "w-[88px] px-2" :
          "w-[300px] pl-[40px] pr-2"
    )}>
      <div className="flex flex-col gap-2">
        {/* Mobile Header */}
        {isMobile && <UserInfo />}

        {/* Logo (Desktop only here, MobileNav has its own) */}
        {!isMobile && !collapsed && (
          <Link href="/" className="flex items-center gap-2 px-4 py-2 w-min hover:bg-secondary/50 rounded-full transition-colors mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="h-10 w-10 fill-foreground"
            >
              <polygon points="260.68 64.93 240.51 99.87 240.52 99.89 78.34 380.8 118.75 380.8 260.8 134.76 383.54 345.8 215.64 345.8 272.64 246.42 252.4 211.36 155.22 380.8 185.43 380.8 195.57 380.8 403.89 380.8 419.08 380.8 444.38 380.8 260.68 64.93" />
            </svg>
          </Link>
        )}

        {/* Logo for collapsed mode */}
        {!isMobile && collapsed && (
          <Link href="/" className="flex items-center justify-center w-14 h-14 hover:bg-secondary/50 rounded-full transition-colors mb-1 mx-auto">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="h-10 w-10 fill-foreground"
            >
              <polygon points="260.68 64.93 240.51 99.87 240.52 99.89 78.34 380.8 118.75 380.8 260.8 134.76 383.54 345.8 215.64 345.8 272.64 246.42 252.4 211.36 155.22 380.8 185.43 380.8 195.57 380.8 403.89 380.8 419.08 380.8 444.38 380.8 260.68 64.93" />
            </svg>
          </Link>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "h-14 rounded-full hover:bg-secondary/50 transition-colors",
                  collapsed ? "justify-center w-14 px-0 mx-auto" : "justify-start gap-3 text-xl px-4 w-min",
                  isActive && "font-bold",
                  isMobile && "w-full text-lg"
                )}
                asChild
              >
                <Link href={item.href} className="flex items-center">
                  <div className="flex w-10 items-center justify-center">
                    <item.icon
                      size={25}
                      className={cn("shrink-0", isActive && "fill-current")}
                      strokeWidth={isActive ? 3 : 2}
                      style={{ width: '25px', height: '25px', minWidth: '25px', minHeight: '25px' }}
                    />
                  </div>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </Button>
            )
          })}
        </nav>

        {!isMobile && !collapsed && (
          <Button size="lg" className="mt-4 rounded-full font-bold text-lg h-14 w-[calc(100%-30px)] mx-auto bg-foreground hover:bg-foreground/90 text-background shadow-lg">
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
        <div className="mt-auto mb-1 relative">
          <Button
            variant="ghost"
            className="w-full justify-between h-16 rounded-full px-4 hover:bg-secondary/50 transition-colors"
            onClick={() => setShowMenu(!showMenu)}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={userAvatar} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start text-sm">
                <span className="font-bold">{userName}</span>
                <span className="text-muted-foreground">{userEmail}</span>
              </div>
            </div>
            <MoreHorizontal className="h-5 w-5 hidden lg:block" />
          </Button>

          {/* Dropdown menu for logout */}
          {showMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 px-4 hover:bg-secondary/50 transition-colors text-red-500 hover:text-red-600"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5" />
                <span>退出登录</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Collapsed user avatar */}
      {!isMobile && collapsed && (
        <div className="mt-auto mb-0 relative">
          <Button
            variant="ghost"
            className="w-14 h-14 justify-center rounded-full px-0 hover:bg-secondary/50 transition-colors mx-auto"
            onClick={() => setShowMenu(!showMenu)}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={userAvatar} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
          </Button>

          {/* Dropdown menu for logout */}
          {showMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 px-4 hover:bg-secondary/50 transition-colors text-red-500 hover:text-red-600"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5" />
                <span>退出登录</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
