import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/tags/popular
 * 获取热门标签列表（按使用次数排序）
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "10")

    // 获取热门标签（统计 MessageTag 和 CommentTag 的使用次数）
    const tagStats = await prisma.$queryRaw<Array<{ tagid: string; name: string; color: string | null; count: bigint }>>`
      SELECT
        t.id as "tagid",
        t.name,
        t.color,
        COUNT(mt."messageId") + COUNT(ct."commentId") as count
      FROM "Tag" t
      LEFT JOIN "MessageTag" mt ON t.id = mt."tagId"
      LEFT JOIN "CommentTag" ct ON t.id = ct."tagId"
      GROUP BY t.id, t.name, t.color
      HAVING COUNT(mt."messageId") + COUNT(ct."commentId") > 0
      ORDER BY count DESC
      LIMIT ${limit}
    `

    const popularTags = tagStats.map((stat) => ({
      id: stat.tagid,
      name: stat.name,
      color: stat.color,
      count: Number(stat.count),
    }))

    return Response.json({
      data: popularTags,
    })
  } catch (error) {
    console.error("Failed to fetch popular tags:", error)
    return Response.json(
      { error: "Failed to fetch popular tags" },
      { status: 500 }
    )
  }
}
