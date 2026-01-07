import { Job } from "bullmq"
import prisma from "@/lib/prisma"
import { callOpenAI } from "@/lib/ai/openai"
import { buildSystemPrompt } from "@/lib/ai/openai"

export async function processDailyBriefing(job: Job) {
  console.log(`[DailyBriefing] Starting daily briefing generation`)

  // 获取所有启用了晨报功能的用户
  const usersWithBriefing = await prisma.user.findMany({
    where: {
      aiConfig: {
        enableBriefing: true,
      },
    },
    include: {
      aiConfig: true,
    },
    orderBy: { createdAt: "asc" },
  })

  if (usersWithBriefing.length === 0) {
    console.log(`[DailyBriefing] No users with briefing enabled, skipping`)
    return
  }

  // 为每个用户生成晨报
  for (const user of usersWithBriefing) {
    console.log(`[DailyBriefing] Generating briefing for user: ${user.email}`)

    const config = user.aiConfig
    if (!config) continue

    // 获取昨天的笔记
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const messages = await prisma.message.findMany({
      where: {
        authorId: user.id,
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
      select: { content: true },
      orderBy: { createdAt: "asc" },
    })

    if (messages.length === 0) {
      console.log(`[DailyBriefing] No messages yesterday for user: ${user.email}`)
      continue
    }

    // 生成晨报
    const systemPrompt = await buildSystemPrompt(user.id)
    const contentSummary = messages.map((m) => m.content).join("\n---\n")

    const briefingPrompt = `作为用户的第二大脑，请根据用户昨天的笔记内容生成一份简短的晨报。

昨日笔记内容：
${contentSummary}

请包含以下部分：
1. 📝 昨日回顾：总结昨天记录的主要内容和想法
2. 💡 关键洞察：从笔记中提取的重要观点或学习
3. 🎯 今日建议：基于昨日内容，给出今天可以做的事情

保持简洁，使用 markdown 格式。`

    try {
      const briefingContent = await callOpenAI({
        userId: user.id,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: briefingPrompt },
        ],
        model: config.briefingModel,
      })

      // 取消之前的晨报道顶（查找带有 DailyReview 标签的置顶消息）
      const dailyReviewTag = await prisma.tag.findUnique({
        where: { name: "DailyReview" },
      })

      if (dailyReviewTag) {
        await prisma.message.updateMany({
          where: {
            authorId: user.id,
            isPinned: true,
            tags: {
              some: { tagId: dailyReviewTag.id },
            },
          },
          data: { isPinned: false },
        })
        console.log(`[DailyBriefing] Unpinned previous briefings for user: ${user.email}`)
      }

      // 创建晨报消息
      const yesterdayStr = yesterday.toLocaleDateString("zh-CN")
      const briefing = await prisma.message.create({
        data: {
          content: `# ☀️ 每日晨报 - ${yesterdayStr}\n\n${briefingContent}`,
          authorId: user.id,
          isPinned: true,
        },
      })

      // 添加 DailyReview 标签
      const tag = await prisma.tag.upsert({
        where: { name: "DailyReview" },
        create: { name: "DailyReview", color: "#FFD700" },
        update: {},
      })

      await prisma.messageTag.create({
        data: { messageId: briefing.id, tagId: tag.id },
      })

      console.log(`[DailyBriefing] Created briefing for ${user.email}: ${briefing.id}`)
    } catch (error) {
      console.error(`[DailyBriefing] Failed for user ${user.email}:`, error)
    }
  }

  console.log(`[DailyBriefing] Completed all briefings`)
}
