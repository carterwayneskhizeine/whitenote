# Implementation Plan: Display Comment Thread on Share Page

## Overview

Enhance the message share page (`/share/[id]`) to display all top-level comments, making them clickable to view individual comment share pages. This allows sharing a message to effectively share view access to its entire comment thread.

## Current State

- **Share page** ([`/app/share/[id]/page.tsx`](src/app/share/[id]/page.tsx)): Only shows the main message
- **Public API** ([`/api/public/messages/[id]`](src/app/api/public/messages/[id]/route.ts)): Fetches single message (exists)
- **Missing**: Public API to fetch all comments for a message
- **Comment share pages** ([`/share/comment/[id]`](src/app/share/comment/[id]/page.tsx)): Already exist

## Implementation

### Step 1: Create Public Comments API

**File**: `src/app/api/public/messages/[id]/comments/route.ts` (NEW)

Create a public endpoint to fetch all top-level comments for a message without authentication.

```typescript
// Route: GET /api/public/messages/[id]/comments
// Based on: src/app/api/messages/[id]/comments/route.ts (without auth)

import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const comments = await prisma.comment.findMany({
    where: { messageId: id, parentId: null },
    include: {
      author: { select: { id: true, name: true, avatar: true, email: true } },
      quotedMessage: {
        select: {
          id: true, content: true, createdAt: true,
          author: { select: { id: true, name: true, avatar: true, email: true } }
        }
      },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      medias: { select: { id: true, url: true, type: true, description: true } },
      _count: { select: { replies: true, retweets: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const commentsWithCounts = comments.map(comment => ({
    ...comment,
    retweetCount: comment._count.retweets
  }))

  return Response.json({ data: commentsWithCounts })
}
```

### Step 2: Create PublicCommentsList Component

**File**: `src/components/PublicCommentsList.tsx` (NEW)

A simplified, read-only version of CommentsList for public share pages.

```typescript
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { CommentItem } from "@/components/CommentItem"

interface PublicCommentsListProps {
  messageId: string
}

export function PublicCommentsList({ messageId }: PublicCommentsListProps) {
  const router = useRouter()
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/public/messages/${messageId}/comments`)
        if (response.ok) {
          const result = await response.json()
          setComments(result.data)
        }
      } catch (err) {
        console.error("Failed to load comments:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchComments()
  }, [messageId])

  const handleCopy = async (comment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(comment.content)
    setCopiedId(comment.id)
    setTimeout(() => setCopiedId(null), 1000)
  }

  const handleShare = (commentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/share/comment/${commentId}`)
  }

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  if (comments.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">暂无评论</div>
  }

  return (
    <div className="flex flex-col">
      <div className="p-4 border-b font-bold">评论</div>
      {comments.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onClick={() => router.push(`/share/comment/${comment.id}`)}
          showMenu={false}
          onReply={undefined}
          onRetweet={undefined}
          onToggleStar={undefined}
          copied={copiedId === comment.id}
          onCopy={(e) => handleCopy(comment, e)}
          onShare={(e) => handleShare(comment.id, e)}
          replyCount={comment._count?.replies || 0}
          retweetCount={comment.retweetCount ?? 0}
          size="md"
          actionRowSize="sm"
        />
      ))}
    </div>
  )
}
```

### Step 3: Update Share Page

**File**: `src/app/share/[id]/page.tsx` (MODIFY)

Add the comments section below the message footer.

1. Add import:
```typescript
import { PublicCommentsList } from "@/components/PublicCommentsList"
```

2. Add comments section after line 298 (after footer info, before lightbox):
```tsx
<Separator className="my-6" />

{/* Comments Section */}
<PublicCommentsList messageId={id} />
```

## Key Design Decisions

### Navigation Strategy
- Comments navigate to `/share/comment/[id]` (public pages)
- Avoids authentication barriers
- Consistent UX for public users

### Component Reuse
- Use existing `CommentItem` with configured props
- Create new `PublicCommentsList` (simpler than modifying existing)
- Hide: edit, delete, reply, retweet, star
- Keep: copy, share (for navigation)

### Data Display
- Only show top-level comments on share page
- Nested replies accessible via comment detail page
- Keeps share page clean and performant

## Verification Steps

1. Create a test message with comments
2. Visit `/share/[messageId]`
3. Verify all top-level comments are displayed
4. Click a comment → navigates to `/share/comment/[commentId]`
5. Test with comments containing media, tags, quoted messages
6. Test empty state (message with no comments)

## Critical Files

| File | Action |
|------|--------|
| `src/app/api/public/messages/[id]/comments/route.ts` | CREATE |
| `src/components/PublicCommentsList.tsx` | CREATE |
| `src/app/share/[id]/page.tsx` | MODIFY |
