# WhiteNote 2.5 后端开发指南 - Stage 7: 后台任务队列

> **前置文档**: [Stage 6: AI 集成](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_06_AI.md)
> **下一步**: [Stage 8: 实时多端同步](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_08_REALTIME_SYNC.md)
> **状态**: ✅ 已完成 (2026-01-02)

---

## 目标

使用 BullMQ + Redis 实现后台任务队列，处理自动打标签、RAGFlow 同步、每日晨报等异步任务。


---

## Step 1: 安装依赖

```bash
pnpm add bullmq ioredis
pnpm add -D @types/ioredis
```

---

## Step 2: 创建 Redis 连接

### 创建 `src/lib/redis.ts`：

```typescript
import { Redis } from "ioredis"

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:4338", {
  maxRetriesPerRequest: null,
})

export default redis
```

更新 `.env`：

```env
# Redis
REDIS_URL="redis://localhost:4338"
```

---

## Step 3: 创建任务队列配置

### 创建 `src/lib/queue/index.ts`：

```typescript
import { Queue, Worker, Job } from "bullmq"
import redis from "@/lib/redis"

// 任务类型
export type JobType = "auto-tag" | "sync-ragflow" | "daily-briefing" | "cleanup-versions"

// 队列名称
const QUEUE_NAME = "whitenote-tasks"

// 创建队列
export const taskQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

/**
 * 添加任务到队列
 */
export async function addTask<T>(
  type: JobType,
  data: T,
  options?: {
    delay?: number
    priority?: number
    jobId?: string
  }
) {
  return taskQueue.add(type, data, {
    ...options,
    jobId: options?.jobId || `${type}-${Date.now()}`,
  })
}

/**
 * 添加定时任务 (Cron)
 */
export async function addCronTask<T>(
  type: JobType,
  data: T,
  cronPattern: string
) {
  return taskQueue.add(type, data, {
    repeat: {
      pattern: cronPattern,
    },
  })
}
```

---

## Step 4: 创建任务处理器

### 创建 `src/lib/queue/processors/auto-tag.ts`：

```typescript
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

  // 调用自动打标签（传入 userId）
  await applyAutoTags(userId, messageId, config.autoTagModel)

  console.log(`[AutoTag] Completed for message: ${messageId}`)
}
```

### 创建 `src/lib/queue/processors/sync-ragflow.ts`：

```typescript
import { Job } from "bullmq"
import prisma from "@/lib/prisma"
import { syncToRAGFlow } from "@/lib/ai/ragflow"

interface SyncRAGFlowJobData {
  userId: string
  messageId: string
}

export async function processSyncRAGFlow(job: Job<SyncRAGFlowJobData>) {
  const { userId, messageId } = job.data

  console.log(`[SyncRAGFlow] Processing message: ${messageId}`)

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, content: true },
  })

  if (message) {
    await syncToRAGFlow(userId, message.id, message.content)
  }

  console.log(`[SyncRAGFlow] Completed for message: ${messageId}`)
}
```

### 创建 `src/lib/queue/processors/daily-briefing.ts`：

```typescript
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
```

---

## Step 5: 创建 Worker 主进程

### 创建 `src/lib/queue/worker.ts`：

```typescript
import { Worker, Job } from "bullmq"
import redis from "@/lib/redis"
import { processAutoTag } from "./processors/auto-tag"
import { processSyncRAGFlow } from "./processors/sync-ragflow"
import { processDailyBriefing } from "./processors/daily-briefing"

const QUEUE_NAME = "whitenote-tasks"

/**
 * 创建并启动 Worker
 */
export function startWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      console.log(`[Worker] Processing job: ${job.name} (${job.id})`)
      
      switch (job.name) {
        case "auto-tag":
          await processAutoTag(job)
          break
        case "sync-ragflow":
          await processSyncRAGFlow(job)
          break
        case "daily-briefing":
          await processDailyBriefing(job)
          break
        default:
          console.warn(`[Worker] Unknown job type: ${job.name}`)
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  )
  
  worker.on("completed", (job) => {
    console.log(`[Worker] Job completed: ${job.name} (${job.id})`)
  })
  
  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job failed: ${job?.name} (${job?.id})`, err)
  })
  
  return worker
}
```

---

## Step 6: 启动脚本

### 创建 `scripts/worker.ts`：

```typescript
import "dotenv/config"
import { startWorker } from "@/lib/queue/worker"
import { addCronTask } from "@/lib/queue"

async function main() {
  console.log("Starting WhiteNote Worker...")
  
  // 启动 Worker
  const worker = startWorker()
  
  // 注册每日晨报定时任务 (每天早上 8:00)
  await addCronTask("daily-briefing", {}, "0 8 * * *")
  console.log("Registered daily briefing cron job")
  
  // 优雅退出
  process.on("SIGTERM", async () => {
    console.log("Shutting down worker...")
    await worker.close()
    process.exit(0)
  })
  
  console.log("Worker is running. Press Ctrl+C to exit.")
}

main().catch(console.error)
```

更新 `package.json`：

```json
{
  "scripts": {
    "worker": "tsx scripts/worker.ts"
  }
}
```

---

## Step 7: 集成到消息创建流程

更新 `src/app/api/messages/route.ts` 的 POST 方法，添加任务调度：

```typescript
import { addTask } from "@/lib/queue"

// ... 在消息创建成功后添加：

// 获取用户 AI 配置
const config = await prisma.aiConfig.findUnique({
  where: { userId: session.user.id },
})

// 添加自动打标签任务（如果启用）
if (config?.enableAutoTag) {
  await addTask("auto-tag", {
    userId: session.user.id,
    messageId: message.id,
  })
}

// 添加 RAGFlow 同步任务（始终保持同步）
await addTask("sync-ragflow", {
  userId: session.user.id,
  messageId: message.id,
})
```

---

## 运行指南

需要同时运行两个进程：

```bash
# 终端 1: 启动 Next.js 开发服务器
pnpm dev

# 终端 2: 启动 Worker 进程
pnpm worker
```

---

## 任务类型汇总

| 任务类型 | 触发方式 | 说明 |
|----------|----------|------|
| `auto-tag` | 消息创建时 | 自动为新消息生成标签 |
| `sync-ragflow` | 消息创建/更新时 | 同步消息到 RAGFlow 知识库 |
| `daily-briefing` | 每日 08:00 Cron | 生成每日晨报 |
| `cleanup-versions` | 可手动触发 | 清理过多的版本历史 |

---

## 实现要点

### 1. prisma 导入方式

⚠️ **注意**: Prisma Client 使用**默认导出**而非命名导出：

```typescript
// ✅ 正确
import prisma from "@/lib/prisma"

// ❌ 错误
import { prisma } from "@/lib/prisma"
```

本 Stage 所有代码示例中的 prisma 导入均需使用默认导出方式。

### 2. Worker 进程独立运行

Worker 必须作为独立进程运行（`pnpm worker`），不能集成到 Next.js 进程中。

### 3. Redis 连接复用

多个 Queue 和 Worker 共享同一个 Redis 连接实例（`ioredis`），避免连接数过多。

---

## 验证检查点

```bash
# 1. 确保 Redis 运行中
docker exec whitenote-redis redis-cli ping
# 应返回 PONG

# 2. 启动 Worker
pnpm worker

# 3. 创建消息后检查 Worker 日志
# 应看到 [AutoTag] 和 [SyncRAGFlow] 的日志输出
```