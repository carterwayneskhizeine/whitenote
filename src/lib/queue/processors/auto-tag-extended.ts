import type { Job } from "@/lib/queue/types"
import prisma from "@/lib/prisma"
import { applyAutoTags } from "@/lib/ai/auto-tag"
import { addTask } from "@/lib/queue"

interface AutoTagJobData {
  userId: string
  workspaceId: string
  messageId?: string
  commentId?: string
  contentType: 'message' | 'comment'
}

/**
 * 扩展的自动打标签处理器，同时支持消息和评论
 */
export async function processAutoTagExtended(job: Job<AutoTagJobData>) {
  const { userId, workspaceId, messageId, commentId, contentType } = job.data

  const contentId = messageId || commentId
  if (!contentId) {
    console.error("[AutoTagExtended] No content ID provided")
    return
  }

  console.log(`[AutoTagExtended] Processing ${contentType}: ${contentId}`)

  let authorId: string | null = null

  // 根据类型获取作者
  if (contentType === 'message') {
    const message = await prisma.message.findUnique({
      where: { id: contentId },
      select: { authorId: true },
    })

    if (!message) {
      console.error(`[AutoTagExtended] Message not found: ${contentId}`)
      return
    }

    authorId = message.authorId
  } else {
    const comment = await prisma.comment.findUnique({
      where: { id: contentId },
      select: { authorId: true },
    })

    if (!comment) {
      console.error(`[AutoTagExtended] Comment not found: ${contentId}`)
      return
    }

    authorId = comment.authorId
  }

  // 对于系统生成的内容（如 AI 评论，无 authorId），使用任务中提供的 userId
  // userId 是消息作者（触发 AI 回复的用户）
  const targetUserId = authorId || userId

  // 获取 Workspace 配置
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { enableAutoTag: true },
  })

  // 获取用户配置（用于获取 autoTagModel）
  const config = await prisma.aiConfig.findUnique({
    where: { userId: targetUserId },
  })

  if (!workspace?.enableAutoTag) {
    console.log(`[AutoTagExtended] Auto-tagging disabled for workspace: ${workspaceId}`)
    // 即使未启用自动打标签，也要同步到 RAGFlow
    await addTask("sync-ragflow", {
      userId: targetUserId,
      workspaceId,
      messageId: contentId,
      contentType,
    })
    return
  }

  // 调用自动打标签（目前只支持消息，需要扩展 applyAutoTags）
  try {
    // 使用消息 ID 调用现有的 applyAutoTags
    // 注意：这会尝试将标签添加到 MessageTag 表，对于评论我们需要单独处理
    const autoTagModel = config?.autoTagModel

    if (contentType === 'message') {
      await applyAutoTags(targetUserId, contentId, autoTagModel)
    } else {
      // 评论的自动打标签 - 复用相同的逻辑
      await applyAutoTagsToComment(targetUserId, contentId, autoTagModel)
    }

    console.log(`[AutoTagExtended] Completed for ${contentType}: ${contentId}`)

    // 打完标签后，触发 RAGFlow 同步（确保标签被包含）
    try {
      await addTask("sync-ragflow", {
        userId: targetUserId,
        workspaceId,
        messageId: contentId,
        contentType,
      })
      console.log(`[AutoTagExtended] Triggered sync-ragflow job for ${contentType}: ${contentId}`)
    } catch (error) {
      console.error(`[AutoTagExtended] Failed to trigger sync-ragflow:`, error)
    }
  } catch (error) {
    console.error(`[AutoTagExtended] Failed for ${contentType} ${contentId}:`, error)
  }
}

/**
 * 为评论应用自动打标签
 * 复用 applyAutoTags 的逻辑，但是将标签关联到评论
 */
async function applyAutoTagsToComment(
  userId: string,
  commentId: string,
  model?: string
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { content: true },
  })

  if (!comment) {
    console.error(`[AutoTagExtended] Comment not found: ${commentId}`)
    return
  }

  // 获取用户配置
  const { getAiConfig } = await import("@/lib/ai/config")
  const config = await getAiConfig(userId)

  // 如果未指定模型，使用配置中的 autoTagModel
  const modelToUse = model || config.autoTagModel || "gpt-3.5-turbo"

  // 调用 AI 生成标签（复用消息的逻辑）
  const { callOpenAI } = await import("@/lib/ai/openai")
  const { batchUpsertTags } = await import("@/lib/tag-utils")

  const prompt = `分析以下文本内容，提取 1-3 个核心关键词作为标签。
标签要求：
1. 使用英文或中文
2. 简洁明了（每个标签 2-15 个字符）
3. 能够代表内容的核心主题
4. 以 JSON 数组格式返回，例如：["React", "前端", "学习"]

文本内容：
${comment.content}

请只返回 JSON 数组，不要包含其他解释文字。`

  try {
    const response = await callOpenAI({
      userId,
      messages: [
        {
          role: "system",
          content: "你是一个专业的文本标签生成助手，擅长从文本中提取核心关键词。",
        },
        { role: "user", content: prompt },
      ],
      model: modelToUse,
    })

    // 解析 AI 返回的标签
    let tags: string[] = []
    try {
      const cleaned = response.trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0])
      } else {
        tags = JSON.parse(cleaned)
      }

      if (!Array.isArray(tags)) {
        throw new Error("Response is not an array")
      }

      tags = tags.filter(
        (tag) => typeof tag === "string" && tag.trim().length > 0
      )
    } catch (parseError) {
      console.error("[AutoTagExtended] Failed to parse AI response:", response)
      const hashtagRegex = /#?([\u4e00-\u9fa5a-zA-Z0-9_]{2,15})/g
      const matches = response.match(hashtagRegex)
      if (matches) {
        tags = matches.map((m) => m.replace("#", ""))
      } else {
        tags = []
      }
    }

    if (tags.length === 0) {
      console.log(`[AutoTagExtended] No tags extracted for comment: ${commentId}`)
      return
    }

    // 限制标签数量
    tags = tags.slice(0, 3)

    console.log(`[AutoTagExtended] Extracted tags for comment ${commentId}:`, tags)

    // 批量创建或关联标签
    const tagIds = await batchUpsertTags(tags)

    // 将标签关联到评论
    await prisma.commentTag.createMany({
      data: tagIds.map((tagId) => ({
        commentId,
        tagId,
      })),
    })

    console.log(`[AutoTagExtended] Successfully applied tags to comment: ${commentId}`)
  } catch (error) {
    console.error(`[AutoTagExtended] Failed for comment ${commentId}:`, error)
  }
}
