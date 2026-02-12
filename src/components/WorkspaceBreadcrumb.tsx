"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { ChevronDown, Check, Search, Loader2 } from "lucide-react"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import { workspacesApi } from "@/lib/api/workspaces"
import type { Workspace } from "@/types/api"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

interface WorkspaceBreadcrumbProps {
  onWorkspaceChange?: (workspaceId: string) => void
}

export function WorkspaceBreadcrumb({ onWorkspaceChange }: WorkspaceBreadcrumbProps) {
  const { data: session } = useSession()
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (session?.user) {
        try {
          const result = await workspacesApi.getWorkspaces()
          if (result.data) {
            setWorkspaces(result.data)
            if (!currentWorkspaceId && result.data.length > 0) {
              const defaultWorkspace = result.data.find((w) => w.isDefault) || result.data[0]
              setCurrentWorkspaceId(defaultWorkspace.id)
            }
          }
        } catch (error) {
          console.error("Failed to fetch workspaces:", error)
        } finally {
          setIsLoading(false)
        }
      }
    }
    fetchWorkspaces()
  }, [session, currentWorkspaceId, setCurrentWorkspaceId])

  useEffect(() => {
    if (isOpen) {
      const searchInput = document.querySelector("[data-workspace-search]") as HTMLInputElement
      searchInput?.focus()
    }
  }, [isOpen])

  if (!mounted || isLoading) {
    return (
      <div className="h-9 px-3 flex items-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleWorkspaceSelect = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    setSearchQuery("")
    onWorkspaceChange?.(workspaceId)
  }

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "h-9 px-3 flex items-center text-sm font-medium transition-colors",
            "hover:bg-secondary/50 rounded-md",
            "focus:outline-none",
            "min-w-0 max-w-50"
          )}
        >
          <span className="truncate">
            {currentWorkspace?.name || "选择工作区"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        className="w-70 p-0"
      >
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-workspace-search
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索工作区..."
              className="h-9 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div className="max-h-75 overflow-y-auto">
          {filteredWorkspaces.length === 0 ? (
            <div className="py-8 px-4 text-center text-sm text-muted-foreground">
              {searchQuery ? "未找到匹配的工作区" : "暂无工作区"}
            </div>
          ) : (
            filteredWorkspaces.map((ws) => {
              const isActive = ws.id === currentWorkspaceId
              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleWorkspaceSelect(ws.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                    isActive && "bg-secondary/30"
                  )}
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {ws.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium text-sm truncate",
                        isActive && "text-primary"
                      )}>
                        {ws.name}
                      </span>
                      {ws.isDefault && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                          默认
                        </span>
                      )}
                    </div>
                    {ws.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {ws.description}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              )
            })
          )}
        </div>

        {filteredWorkspaces.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <DropdownMenuItem
                asChild
                className="w-full justify-center font-medium text-sm cursor-pointer"
              >
                <a href="/settings/workspaces" className="flex items-center justify-center">
                  管理工作区
                </a>
              </DropdownMenuItem>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
