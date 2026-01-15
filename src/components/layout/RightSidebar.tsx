"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Search, MoreHorizontal, Hash, Clock, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { searchApi } from "@/lib/api/search"
import { tagsApi } from "@/lib/api/tags"
import { MessageWithRelations } from "@/types/api"
import { useRouter } from "next/navigation"

type SearchHistoryItem = {
  id: string
  query: string
  createdAt: string
}

type PopularTag = {
  id: string
  name: string
  color: string | null
  count: number
}

export function RightSidebar() {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<MessageWithRelations[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [popularTags, setPopularTags] = useState<PopularTag[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingPopularTags, setIsLoadingPopularTags] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isDropdownHovered, setIsDropdownHovered] = useState(false)

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

  // 加载热门标签
  const loadPopularTags = useCallback(async () => {
    setIsLoadingPopularTags(true)
    try {
      const result = await tagsApi.getPopularTags(5)
      if (result.data) {
        setPopularTags(result.data)
      }
    } catch (error) {
      console.error("Failed to load popular tags:", error)
    } finally {
      setIsLoadingPopularTags(false)
    }
  }, [])

  // 初始化时加载热门标签
  useEffect(() => {
    loadPopularTags()
  }, [loadPopularTags])

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
      debouncedSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, debouncedSearch])

  // 确认搜索（记录历史）
  const handleConfirmSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    try {
      const result = await searchApi.search({ q: query, saveHistory: true })
      if (result.data) {
        setSearchResults(result.data)
        setShowResults(true)
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
    // 保持搜索结果显示，直到失去焦点
  }

  // 点击搜索结果（记录搜索历史）
  const handleResultClick = async (messageId: string, query: string) => {
    // 记录搜索历史
    await searchApi.search({ q: query, saveHistory: true })
    router.push(`/status/${messageId}`)
    setShowResults(false)
    setSearchQuery("")
    // 刷新搜索历史
    loadSearchHistory()
  }

  // 聚焦时加载搜索历史
  const handleFocus = () => {
    setShowResults(true)
    loadSearchHistory()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleConfirmSearch(searchQuery)
      setShowResults(false)
    }
  }

  // 处理输入框失去焦点
  const handleBlur = () => {
    // 如果鼠标悬停在下拉框内，不关闭
    setTimeout(() => {
      if (!isDropdownHovered) {
        setShowResults(false)
      }
    }, 200)
  }

  return (
    <aside className="w-[390px] flex flex-col gap-4 px-4 pt-0 pb-4 hidden desktop:flex relative">
      {/* Search */}
      <div className="sticky top-0 bg-background z-50 pt-[6px] pb-2">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary" />
          <Input
            placeholder="搜索消息、标签... (按回车确认)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="pl-12 h-10 rounded-full bg-background dark:bg-background border border-border focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* Search Results & History Dropdown */}
        {showResults && (
          <Card
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-lg z-50 max-h-[500px] overflow-y-auto"
            onMouseEnter={() => setIsDropdownHovered(true)}
            onMouseLeave={() => setIsDropdownHovered(false)}
          >
            {/* 搜索历史 */}
            {!searchQuery && (
              <>
                {isLoadingHistory ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    加载中...
                  </div>
                ) : searchHistory.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    暂无搜索历史
                  </div>
                ) : (
                  <div className="divide-y">
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                      最近搜索
                    </div>
                    {searchHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleHistoryClick(item.query)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between group"
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
                )}
              </>
            )}

            {/* 搜索结果 */}
            {searchQuery && (
              <>
                {isSearching ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    搜索中...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    未找到相关结果
                  </div>
                ) : (
                  <div className="divide-y">
                    {searchResults.map((message) => (
                      <button
                        key={message.id}
                        onClick={() => handleResultClick(message.id, searchQuery)}
                        className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
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
          </Card>
        )}
      </div>

      {/* Trending Tags */}
      <Card className="shadow-none border border-border bg-card rounded-2xl overflow-hidden pt-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-extrabold">热门标签</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 px-0">
          {isLoadingPopularTags ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : popularTags.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              暂无热门标签
            </div>
          ) : (
            popularTags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => router.push(`/tags?tag=${tag.name}`)}
                className="flex justify-between items-start px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold text-base">{tag.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {tag.count} 条消息
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-xs text-muted-foreground px-4 flex flex-wrap gap-x-3 gap-y-1">
        <a href="#" className="hover:underline">服务条款</a>
        <a href="#" className="hover:underline">隐私政策</a>
        <a href="#" className="hover:underline">Cookie 政策</a>
        <a href="#" className="hover:underline">无障碍</a>
        <span>© 2026 WhiteNote</span>
      </div>
    </aside>
  )
}
