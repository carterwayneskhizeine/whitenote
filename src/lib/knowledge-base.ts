import prisma from "@/lib/prisma"
import { addTask } from "@/lib/queue"

/**
 * 统一的知识库同步工具
 * 处理消息和评论的自动打标签和 RAGFlow 同步
 */

export type ContentType = 'message' | 'comment'

/**
 * 为内容触发自动打标签和知识库同步
 * @param type 内容类型 (message | comment)
 * @param contentId 内容 ID
 * @param userId 用户 ID
 * @param enableAutoTag 是否启用自动打标签
 */
export async function syncToKnowledgeBase(
  type: ContentType,
  contentId: string,
  userId: string,
  enableAutoTag: boolean = true
) {
  try {
    if (enableAutoTag) {
      // 添加自动打标签任务
      // 注意：auto-tag 完成后会自动触发 sync-ragflow
      await addTask("auto-tag", {
        userId,
        messageId: contentId, // auto-tag 处理器目前只支持消息，我们需要扩展它
      })
    } else {
      // 如果未启用自动打标签，直接同步到 RAGFlow
      await addTask("sync-rag", {
        userId,
        messageId: contentId,
        contentType: type,
      })
    }

    console.log(`[KnowledgeBase] Queued sync task for ${type} ${contentId}`)
  } catch (error) {
    console.error(`[KnowledgeBase] Failed to queue sync task for ${type} ${contentId}:`, error)
  }
}

/**
 * 构建包含标签的内容（用于 RAGFlow 同步）
 * @param type 内容类型 (message | comment)
 * @param contentId 内容 ID
 */
export async function buildContentWithTags(
  type: ContentType,
  contentId: string
): Promise<string> {
  if (type === 'message') {
    const message = await prisma.message.findUnique({
      where: { id: contentId },
      select: {
        content: true,
        tags: {
          include: {
            tag: { select: { name: true } },
          },
          orderBy: {
            tag: { name: 'asc' },
          },
        },
      },
    })

    if (!message) return ''

    // 如果有标签，格式化标签放在内容开头
    if (message.tags.length > 0) {
      const tagLine = message.tags.map((t) => `#${t.tag.name}`).join(' ')
      return `${tagLine}\n\n${message.content}`
    }

    return message.content
  } else {
    const comment = await prisma.comment.findUnique({
      where: { id: contentId },
      select: {
        content: true,
        tags: {
          include: {
            tag: { select: { name: true } },
          },
          orderBy: {
            tag: { name: 'asc' },
          },
        },
      },
    })

    if (!comment) return ''

    // 如果有标签，格式化标签放在内容开头
    if (comment.tags.length > 0) {
      const tagLine = comment.tags.map((t) => `#${t.tag.name}`).join(' ')
      return `${tagLine}\n\n${comment.content}`
    }

    return comment.content
  }
}

/**
 * 删除知识库中的内容
 * @param userId 用户 ID
 * @param datasetId RAGFlow Dataset ID
 * @param type 内容类型 (message | comment)
 * @param contentId 内容 ID
 */
export async function deleteFromKnowledgeBase(
  userId: string,
  datasetId: string,
  type: ContentType,
  contentId: string
) {
  try {
    // 导入 RAGFlow 删除函数
    const { deleteFromRAGFlow } = await import("./ai/ragflow")
    await deleteFromRAGFlow(userId, datasetId, contentId, type)
    console.log(`[KnowledgeBase] Deleted ${type} ${contentId} from RAGFlow`)
  } catch (error) {
    console.error(`[KnowledgeBase] Failed to delete ${type} ${contentId} from RAGFlow:`, error)
  }
}

/**
 * 更新知识库中的内容
 * @param userId 用户 ID
 * @param datasetId RAGFlow Dataset ID
 * @param type 内容类型 (message | comment)
 * @param contentId 内容 ID
 */
export async function updateInKnowledgeBase(
  userId: string,
  datasetId: string,
  type: ContentType,
  contentId: string
) {
  try {
    // 导入 RAGFlow 更新函数
    const { updateRAGFlow } = await import("./ai/ragflow")

    // 获取更新后的完整内容（包含标签）
    const contentWithTags = await buildContentWithTags(type, contentId)

    await updateRAGFlow(userId, datasetId, contentId, contentWithTags)
    console.log(`[KnowledgeBase] Updated ${type} ${contentId} in RAGFlow`)
  } catch (error) {
    console.error(`[KnowledgeBase] Failed to update ${type} ${contentId} in RAGFlow:`, error)
  }
}
