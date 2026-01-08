"use client"

import { MessagesList } from "@/components/MessagesList"
import { useMemo } from "react"

export default function FavoritesPage() {
  // Use useMemo to prevent infinite re-renders
  const filters = useMemo(() => ({ isStarred: true, rootOnly: false }), [])

  return (
    <>
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b p-4">
        <h1 className="text-xl font-bold">收藏</h1>
      </div>
      <MessagesList filters={filters} />
    </>
  )
}
