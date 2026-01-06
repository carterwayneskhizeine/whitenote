"use client"

import { useState } from "react"
import { Search, MoreHorizontal, Hash } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { searchApi } from "@/lib/api/search"
import { MessageWithRelations } from "@/types/api"
import { useRouter } from "next/navigation"

export function RightSidebar() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<MessageWithRelations[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const handleSearch = async (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    try {
      const result = await searchApi.search({ q: query })
      if (result.data) {
        setSearchResults(result.data)
        setShowResults(true)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <aside className="w-[390px] flex flex-col gap-4 px-4 pt-0 pb-4 hidden desktop:flex relative">
      {/* Search */}
      <div className="sticky top-0 bg-background z-50 pt-[6px] pb-2">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary" />
          <Input
            placeholder="搜索消息、标签..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="pl-12 h-10 rounded-full bg-background dark:bg-background border border-border focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchQuery && (
          <Card className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-lg z-50 max-h-[500px] overflow-y-auto">
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
                    onClick={() => {
                      router.push(`/?message=${message.id}`)
                      setShowResults(false)
                      setSearchQuery("")
                    }}
                    className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">
                            {message.author.name}
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
          </Card>
        )}
      </div>

      {/* Trending Tags */}
      <Card className="shadow-none border border-border bg-card rounded-2xl overflow-hidden pt-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-extrabold">热门标签</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 px-0">
          {['学习笔记', 'AI工具', 'React', 'NextJS', '产品设计'].map((tag, i) => (
            <div
              key={tag}
              onClick={() => router.push(`/tags`)}
              className="flex justify-between items-start px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold text-base">{tag}</span>
                </div>
                <span className="text-xs text-muted-foreground">{10 - i * 2}.5K 条消息</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          ))}
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
