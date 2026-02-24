import prisma from "@/lib/prisma"

/**
 * 获取帖子下的评论线程上下文，格式化为 AI 可读的对话历史
 * 返回最近 20 条评论（按时间升序），不包含尚未保存的新评论
 */
export async function getCommentThreadContext(messageId: string): Promise<string> {
  const comments = await prisma.comment.findMany({
    where: { messageId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      content: true,
      createdAt: true,
      isAIBot: true,
      author: { select: { name: true } },
      parent: {
        select: {
          isAIBot: true,
          author: { select: { name: true } },
        },
      },
    },
  })

  if (comments.length === 0) return ''

  comments.reverse() // 转为时间升序，让 AI 按对话顺序理解

  const lines: string[] = ['', '评论历史：']
  for (const comment of comments) {
    const time = comment.createdAt.toISOString().replace('T', ' ').slice(0, 16)
    const authorName = comment.isAIBot ? 'AI (GoldieRill)' : (comment.author?.name || '匿名用户')
    const replyInfo = comment.parent
      ? `（回复 ${comment.parent.isAIBot ? 'AI' : (comment.parent.author?.name || '匿名用户')}）`
      : ''
    lines.push(`[${time}] ${authorName}${replyInfo}: ${comment.content}`)
  }

  return lines.join('\n')
}
