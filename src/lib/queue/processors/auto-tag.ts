import { Job } from "bullmq"
import prisma from "@/lib/prisma"
import { applyAutoTags } from "@/lib/ai/auto-tag"

interface AutoTagJobData {
  userId: string
  messageId: string
}

export async function processAutoTag(job: Job<AutoTagJobData>) {
  const { userId, messageId } = job.data

  console.log(`[AutoTag] Processing message: ${messageId}`)

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true },
  })

  if (!message) {
    console.error(`[AutoTag] Message not found: ${messageId}`)
    return
  }

  // 获取用户配置
  const config = await prisma.aiConfig.findUnique({
    where: { userId: message.authorId },
  })

  if (!config?.enableAutoTag) {
    console.log(`[AutoTag] Auto-tagging disabled for user: ${message.authorId}`)
    return
  }

  // 调用自动打标签
  await applyAutoTags(userId, messageId, config.autoTagModel)

  console.log(`[AutoTag] Completed for message: ${messageId}`)
}
