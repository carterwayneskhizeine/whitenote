import type { Job } from "@/lib/queue/types"
import prisma from "@/lib/prisma"
import { applyAutoTags } from "@/lib/ai/auto-tag"
import { addTask } from "@/lib/queue"

interface AutoTagJobData {
  userId: string
  workspaceId: string
  messageId: string
}

export async function processAutoTag(job: Job<AutoTagJobData>) {
  const { userId, workspaceId, messageId } = job.data

  console.log(`[AutoTag] Processing message: ${messageId}`)

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true },
  })

  if (!message) {
    console.error(`[AutoTag] Message not found: ${messageId}`)
    return
  }

  // 晨报等系统生成的消息没有 authorId，跳过自动打标签
  if (!message.authorId) {
    console.log(`[AutoTag] Message has no author (system message), skipping: ${messageId}`)
    return
  }

  // 获取 Workspace 配置
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { enableAutoTag: true },
  })

  if (!workspace?.enableAutoTag) {
    console.log(`[AutoTag] Auto-tagging disabled for workspace: ${workspaceId}`)
    return
  }

  // 获取用户配置（用于获取 autoTagModel）
  const config = await prisma.aiConfig.findUnique({
    where: { userId: message.authorId },
  })

  // 调用自动打标签
  await applyAutoTags(userId, messageId, config?.autoTagModel)

  console.log(`[AutoTag] Completed for message: ${messageId}`)

  // 打完标签后，触发 RAGFlow 同步（确保标签被包含）
  try {
    await addTask("sync-ragflow", {
      userId,
      workspaceId,
      messageId,
    })
    console.log(`[AutoTag] Triggered sync-ragflow job for message: ${messageId}`)
  } catch (error) {
    console.error(`[AutoTag] Failed to trigger sync-ragflow:`, error)
  }
}
