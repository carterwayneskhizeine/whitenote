"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState } from "react"
import {
  Hash, Bell, Bookmark,
  MoreHorizontal, PenLine, LogOut, UserCircle
} from "lucide-react"

import { cn, getAvatarUrl } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PostDialog } from "@/components/PostDialog"

interface LeftSidebarProps {
  isMobile?: boolean
  collapsed?: boolean
}

// Custom Icons that support filling better/bolding
const XHome = ({ isActive, ...props }: any) => {
  const solidPath = "M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913v-7.075h3.008v7.075c0 .502.418.913.929.913h6.639c.51 0 .928-.41.928-.913V7.904c0-.301-.158-.584-.408-.758z"
  const outlinePath = "M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913v-7.075h3.008v7.075c0 .502.418.913.929.913h6.639c.51 0 .928-.41.928-.913V7.904c0-.301-.158-.584-.408-.758zM20 20l-4.5.01.011-7.097c0-.502-.418-.913-.928-.913H9.44c-.511 0-.929.41-.929.913L8.5 20H4V8.773l8.011-5.342L20 8.764z"

  return (
    <svg 
      viewBox="0 0 24 24" 
      aria-hidden="true" 
      {...props} 
      width={28}
      height={28}
      fill="currentColor"
    >
      <g>
        <path d={isActive ? solidPath : outlinePath}></path>
      </g>
    </svg>
  )
}
const XExplore = ({ isActive, ...props }: any) => (
  <Hash {...props} size={28} strokeWidth={isActive ? 3 : 2} fill={isActive ? "currentColor" : "none"} />
)
const XNotifications = ({ isActive, ...props }: any) => (
  <Bell {...props} size={28} strokeWidth={isActive ? 3 : 2} fill={isActive ? "currentColor" : "none"} />
)
const XBookmarks = ({ isActive, ...props }: any) => (
  <Bookmark {...props} size={28} strokeWidth={isActive ? 3 : 2} fill={isActive ? "currentColor" : "none"} />
)
const XMore = ({ isActive, ...props }: any) => (
  <MoreHorizontal {...props} size={28} strokeWidth={2} />
)

const navItems = [
  { icon: XHome, label: "首页", href: "/" },
  { icon: XExplore, label: "Tags", href: "/tags" },
  { icon: XNotifications, label: "通知", href: "/notifications" },
  { icon: XBookmarks, label: "收藏", href: "/favorites" },
  { icon: XMore, label: "更多", href: "/settings" },
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
  </div>
)

export function LeftSidebar({ isMobile, collapsed }: LeftSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [showMenu, setShowMenu] = useState(false)
  const [showPostDialog, setShowPostDialog] = useState(false)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

  // Use session data directly
  const userName = session?.user?.name || "User Name"
  const userEmail = session?.user?.email
    ? `@${session.user.email.split("@")[0]}`
    : "@username"
  const userAvatar = getAvatarUrl(session?.user?.name || null, session?.user?.image || null) || ""
  const userInitials = userName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "CN"

  return (
    <aside className={cn(
      "sticky top-0 h-screen flex flex-col justify-between py-1 px-2",
      isMobile ? "w-full overflow-y-auto bg-black" :
        collapsed ? "w-[88px] items-center" :
          "w-[275px] items-end"
    )}>
      {/* 
         Logic for Vertical Alignment:
         1. Expand/Collapse states must have the same "right offset" for the icon track.
         2. Collapsed (88px) centered Icon (50px) gives 19px padding on both sides.
         3. Expanded (275px) Right-aligned content block with padding-right that matches.
      */}
      <div className={cn("flex flex-col gap-1", isMobile ? "w-full" : collapsed ? "w-[52px]" : "w-[250px]")}>
        {/* Mobile Header */}
        {isMobile && <UserInfo />}

        {/* Logo */}
        {!isMobile && (
          <Link href="/" className={cn(
            "flex items-center justify-center w-[52px] h-[52px] hover:bg-secondary/50 rounded-full transition-colors mb-2",
            // For expanded, we keep it at the start of the 250px block, but the icons below have px-3.
            // Center of 52px is 26px. 
            // Nav icons below are in 52px containers (w-full collapsed) or start at px-3.
            collapsed ? "" : "ml-0"
          )}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="h-[30px] w-[30px] fill-foreground"
            >
              <polygon points="260.68 64.93 240.51 99.87 240.52 99.89 78.34 380.8 118.75 380.8 260.8 134.76 383.54 345.8 215.64 345.8 272.64 246.42 252.4 211.36 155.22 380.8 185.43 380.8 195.57 380.8 403.89 380.8 419.08 380.8 444.38 380.8 260.68 64.93" />
            </svg>
          </Link>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems
            .filter(item => !isMobile || ["/", "/tags", "/notifications"].includes(item.href))
            .map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center"
              >
                <div className={cn(
                  "flex items-center gap-4 rounded-full transition-colors group-hover:bg-secondary/50",
                  isActive && "font-bold",
                  collapsed ? "w-[52px] h-[52px] justify-center" : "pr-6 pl-3 py-3"
                )}>
                  <item.icon isActive={isActive} className="shrink-0" />
                  {!collapsed && <span className="text-xl leading-none pt-1">{item.label}</span>}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Post Button */}
        {!isMobile && (
          <div className="my-4">
            <Button
              size="lg"
              onClick={() => setShowPostDialog(true)}
              className={cn(
                "rounded-full font-bold text-[17px] shadow-lg bg-white hover:bg-gray-100 text-black transition-all duration-200 border border-border",
                collapsed ? "w-[52px] h-[52px] p-0" : "w-[225px] h-[52px]"
              )}
            >
              {collapsed ? (
                <PenLine size={24} />
              ) : (
                <span>发布</span>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* User Profile */}
      {!isMobile && (
        <div className={cn("mb-3", collapsed ? "w-[64px]" : "w-[255px]")}>
          <Button
            variant="ghost"
            className={cn(
              "rounded-full hover:bg-secondary/50 transition-colors h-[64px]",
              collapsed ? "w-[64px] h-[64px] p-0 justify-center" : "w-full justify-between px-3"
            )}
            onClick={() => setShowMenu(!showMenu)}
          >
            <div className="flex items-center gap-3 truncate">
              <Avatar className="h-10 w-10 shrink-0">
                {userAvatar && <AvatarImage src={userAvatar} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{userInitials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start text-sm truncate">
                  <span className="font-bold truncate w-full text-left">{userName}</span>
                  <span className="text-muted-foreground truncate w-full text-left">{userEmail}</span>
                </div>
              )}
            </div>
            {!collapsed && <MoreHorizontal className="h-5 w-5 shrink-0 ml-2" />}
          </Button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute bottom-[80px] left-0 w-[300px] shadow-2xl rounded-2xl bg-background border border-border p-2 z-50 overflow-hidden ring-1 ring-border">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" className="w-full justify-start font-bold h-12" onClick={() => router.push('/settings')}>
                  <UserCircle className="h-5 w-5 mr-3" />
                  编辑资料
                </Button>
                <div className="h-px bg-border my-1" />
                <Button variant="ghost" className="w-full justify-start font-bold h-12" onClick={handleSignOut}>
                  <LogOut className="h-5 w-5 mr-3" />
                  退出 {userEmail}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post Dialog */}
      {!isMobile && (
        <PostDialog
          open={showPostDialog}
          onOpenChange={setShowPostDialog}
          onSuccess={() => {
            // Refresh the page to show new post
            router.refresh()
          }}
        />
      )}
    </aside>
  )
}
