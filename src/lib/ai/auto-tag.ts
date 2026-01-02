import { getAiConfig } from "./config"
import { callOpenAI } from "./openai"
import prisma from "@/lib/prisma"

/**
 * 自动为消息生成标签
 * @param userId 用户 ID
 * @param messageId 消息 ID
 * @param model 可选：指定使用的模型（如果未指定则使用配置中的 autoTagModel）
 */
export async function applyAutoTags(
  userId: string,
  messageId: string,
  model?: string
) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { content: true, authorId: true },
  })

  if (!message) {
    console.error(`[AutoTag] Message not found: ${messageId}`)
    return
  }

  // 获取用户配置
  const config = await getAiConfig(userId)

  // 如果未指定模型，使用配置中的 autoTagModel
  const modelToUse = model || config.autoTagModel || "gpt-3.5-turbo"

  // 调用 AI 生成标签
  const prompt = `分析以下文本内容，提取 1-3 个核心关键词作为标签。
标签要求：
1. 使用英文或中文
2. 简洁明了（每个标签 2-15 个字符）
3. 能够代表内容的核心主题
4. 以 JSON 数组格式返回，例如：["React", "前端", "学习"]

文本内容：
${message.content}

请只返回 JSON 数组，不要包含其他解释文字。`

  try {
    const response = await callOpenAI({
      userId,
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的文本标签生成助手，擅长从文本中提取核心关键词。",
        },
        { role: "user", content: prompt },
      ],
      model: modelToUse,
    })

    // 解析 AI 返回的标签
    let tags: string[] = []
    try {
      // 尝试解析 JSON
      const cleaned = response.trim()
      // 提取 JSON 数组部分（去除可能的 Markdown 代码块标记）
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0])
      } else {
        tags = JSON.parse(cleaned)
      }

      // 确保是数组
      if (!Array.isArray(tags)) {
        throw new Error("Response is not an array")
      }

      // 过滤无效标签
      tags = tags.filter(
        (tag) => typeof tag === "string" && tag.trim().length > 0
      )
    } catch (parseError) {
      console.error("[AutoTag] Failed to parse AI response:", response)
      // 如果 JSON 解析失败，尝试提取类似标签的文本
      const hashtagRegex = /#?([\u4e00-\u9fa5a-zA-Z0-9_]{2,15})/g
      const matches = response.match(hashtagRegex)
      if (matches) {
        tags = matches.map((m) => m.replace("#", ""))
      } else {
        tags = []
      }
    }

    if (tags.length === 0) {
      console.log(`[AutoTag] No tags extracted for message: ${messageId}`)
      return
    }

    // 限制标签数量
    tags = tags.slice(0, 3)

    console.log(`[AutoTag] Extracted tags for ${messageId}:`, tags)

    // 创建或关联标签
    for (const tagName of tags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        create: { name: tagName },
        update: {},
      })

      // 检查是否已经关联
      const existing = await prisma.messageTag.findUnique({
        where: {
          messageId_tagId: {
            messageId,
            tagId: tag.id,
          },
        },
      })

      if (!existing) {
        await prisma.messageTag.create({
          data: {
            messageId,
            tagId: tag.id,
          },
        })
      }
    }

    console.log(`[AutoTag] Successfully applied tags to message: ${messageId}`)
  } catch (error) {
    console.error(`[AutoTag] Failed for message ${messageId}:`, error)
  }
}
