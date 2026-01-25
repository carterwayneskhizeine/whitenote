"use client"

import { useState, useCallback, useEffect } from "react"
import { Search, Clock, ArrowLeft, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { searchApi } from "@/lib/api/search"
import { MessageWithRelations } from "@/types/api"
import { useRouter } from "next/navigation"
import { useWorkspaceStore } from "@/store/useWorkspaceStore"
import Link from "next/link"

type SearchHistoryItem = {
  id: string
  query: string
  createdAt: string
}

export default function SearchPage() {
  const router = useRouter()
  const { currentWorkspaceId } = useWorkspaceStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<MessageWithRelations[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // 加载搜索历史
  const loadSearchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const result = await searchApi.getHistory()
      if (result.data) {
        setSearchHistory(result.data)
      }
    } catch (error) {
      console.error("Failed to load search history:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  // 初始化时加载搜索历史
  useEffect(() => {
    loadSearchHistory()
  }, [loadSearchHistory])

  // 防抖搜索（不记录历史）
  const debouncedSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      searchApi.search({ q: query, saveHistory: false })
        .then((result) => {
          if (result.data) {
            setSearchResults(result.data)
          }
        })
        .catch((error) => {
          console.error("Search failed:", error)
        })
        .finally(() => {
          setIsSearching(false)
        })
    },
    []
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        debouncedSearch(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, debouncedSearch])

  // 确认搜索（记录历史）
  const handleConfirmSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const result = await searchApi.search({ q: query, saveHistory: true })
      if (result.data) {
        setSearchResults(result.data)
        // 刷新搜索历史
        loadSearchHistory()
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  // 点击搜索历史项
  const handleHistoryClick = (historyQuery: string) => {
    setSearchQuery(historyQuery)
    handleConfirmSearch(historyQuery)
  }

  // 点击搜索结果（记录搜索历史）
  const handleResultClick = async (messageId: string, query: string) => {
    // 记录搜索历史
    await searchApi.search({ q: query, saveHistory: true })
    router.push(`/status/${messageId}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirmSearch(searchQuery)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border z-50">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="搜索消息、标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 h-10 rounded-full bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary"
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* 搜索历史 */}
        {!searchQuery && (
          <>
            {isLoadingHistory ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                加载中...
              </div>
            ) : searchHistory.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                暂无搜索历史
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="px-2 text-sm font-medium text-muted-foreground">最近搜索</h2>
                <div className="space-y-1">
                  {searchHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistoryClick(item.query)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 rounded-2xl transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{item.query}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 搜索结果 */}
        {searchQuery && (
          <>
            {isSearching ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                搜索中...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                未找到相关结果
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleResultClick(message.id, searchQuery)}
                    className="w-full text-left p-4 hover:bg-muted/50 rounded-2xl transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">
                            {message.author?.name || "AI 助手"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div
                          className="text-sm line-clamp-3 prose prose-sm dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: message.content }}
                        />
                        {message.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {message.tags.map(({ tag }) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                              >
                                #{tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
