"use client"

import { MessagesList } from "@/components/MessagesList"
import { MainLayout } from "@/components/layout/MainLayout"
import { useMemo } from "react"

export default function FavoritesPage() {
  // Use useMemo to prevent infinite re-renders
  const filters = useMemo(() => ({ isStarred: true }), [])

  return (
    <MainLayout>
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b p-4">
        <h1 className="text-xl font-bold">收藏</h1>
      </div>
      <MessagesList filters={filters} />
    </MainLayout>
  )
}
