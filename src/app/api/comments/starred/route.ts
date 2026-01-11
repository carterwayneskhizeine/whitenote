import { requireAuth, AuthError } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/comments/starred
 * 获取用户收藏的所有评论
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()

    const comments = await prisma.comment.findMany({
      where: {
        authorId: session.user.id,
        isStarred: true,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, email: true },
        },
        message: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
        quotedMessage: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Get retweet counts for each comment (including simple retweets and quoted by messages)
    const commentIds = comments.map(c => c.id)
    const [retweetCounts, quotedByCounts] = await Promise.all([
      prisma.retweet.groupBy({
        by: ['commentId'],
        where: { commentId: { in: commentIds } },
        _count: { commentId: true },
      }),
      prisma.message.groupBy({
        by: ['quotedCommentId'],
        where: { quotedCommentId: { in: commentIds } },
        _count: { quotedCommentId: true },
      }),
    ])

    const retweetCountMap = Object.fromEntries(
      retweetCounts.map(r => [r.commentId, r._count.commentId])
    )
    const quotedByCountMap = Object.fromEntries(
      quotedByCounts.map(r => [r.quotedCommentId!, r._count.quotedCommentId])
    )

    const commentsWithRetweetCount = comments.map(comment => ({
      ...comment,
      retweetCount: (retweetCountMap[comment.id] || 0) + (quotedByCountMap[comment.id] || 0),
    }))

    return Response.json({ data: commentsWithRetweetCount })
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to fetch starred comments:", error)
    return Response.json({ error: "Failed to fetch starred comments" }, { status: 500 })
  }
}
