import type { Job } from "@/lib/queue/types"
import prisma from "@/lib/prisma"
import { syncToRAG } from "@/lib/ai/rag"

interface SyncRAGJobData {
  userId: string
  workspaceId: string
  messageId: string
  contentType?: 'message' | 'comment'
}

export async function processSyncRAG(job: Job<SyncRAGJobData>) {
  const { userId, workspaceId, messageId, contentType = 'message' } = job.data

  // CRITICAL: Never index AI bot comments
  if (contentType === 'comment') {
    const comment = await prisma.comment.findUnique({
      where: { id: messageId },
      select: { isAIBot: true },
    })
    if (comment?.isAIBot) {
      console.log(`[SyncRAG] Skipping AI bot comment: ${messageId}`)
      return
    }
  }

  // Fetch content with tags
  let contentWithTags: string
  let medias: Array<{ id: string; url: string; type: string }> = []

  if (contentType === 'message') {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        content: true,
        tags: {
          include: { tag: { select: { name: true } } },
          orderBy: { tag: { name: 'asc' } },
        },
        medias: { select: { id: true, url: true, type: true } },
      },
    })

    if (!message) return

    contentWithTags = message.tags.length > 0
      ? `${message.tags.map(t => `#${t.tag.name}`).join(' ')}\n\n${message.content}`
      : message.content
    medias = message.medias
  } else {
    const comment = await prisma.comment.findUnique({
      where: { id: messageId },
      select: {
        content: true,
        tags: {
          include: { tag: { select: { name: true } } },
          orderBy: { tag: { name: 'asc' } },
        },
        medias: { select: { id: true, url: true, type: true } },
      },
    })

    if (!comment) return

    contentWithTags = comment.tags.length > 0
      ? `${comment.tags.map(t => `#${t.tag.name}`).join(' ')}\n\n${comment.content}`
      : comment.content
    medias = comment.medias
  }

  await syncToRAG(userId, workspaceId, messageId, contentType, contentWithTags, medias)
  console.log(`[SyncRAG] Completed for ${contentType}: ${messageId}`)
}
