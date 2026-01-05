"use client"

import { Search, MoreHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function RightSidebar() {
  return (
    <aside className="sticky top-0 h-screen w-[350px] flex-col gap-4 px-4 py-4 hidden desktop:flex overflow-y-auto no-scrollbar">
      {/* Search */}
      <div className="sticky top-0 bg-background z-10 pb-2">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary" />
          <Input
            placeholder="Search"
            className="pl-12 h-12 rounded-full bg-secondary border-none focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Subscribe Card */}
      <Card className="shadow-none border border-border bg-card rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-extrabold">Subscribe to Premium</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4 font-normal">Subscribe to unlock new features and if eligible, receive a share of ads revenue.</p>
          <Button className="rounded-full font-bold px-6 bg-primary hover:bg-primary/90 text-white">Subscribe</Button>
        </CardContent>
      </Card>

      {/* What's Happening (Trends) */}
      <Card className="shadow-none border border-border bg-card rounded-2xl overflow-hidden pt-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-extrabold">What's happening</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 px-0">
          {['#ReactJS', '#NextJS', '#AI Revolution', 'Design Systems'].map((tag, i) => (
            <div key={tag} className="flex justify-between items-start px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Trending in Tech</span>
                <span className="font-bold text-base">{tag}</span>
                <span className="text-xs text-muted-foreground">{10 + i}.5K posts</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="px-4 py-4 text-primary text-sm cursor-pointer hover:bg-accent/50 transition-colors">Show more</div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-xs text-muted-foreground px-4 flex flex-wrap gap-x-3 gap-y-1">
        <a href="#" className="hover:underline">Terms of Service</a>
        <a href="#" className="hover:underline">Privacy Policy</a>
        <a href="#" className="hover:underline">Cookie Policy</a>
        <a href="#" className="hover:underline">Accessibility</a>
        <a href="#" className="hover:underline">Ads info</a>
        <span>© 2026 WhiteNote</span>
      </div>
    </aside>
  )
}
