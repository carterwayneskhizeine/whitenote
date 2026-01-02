import { Queue } from "bullmq"
import redis from "@/lib/redis"

// 任务类型
export type JobType = "auto-tag" | "sync-ragflow" | "daily-briefing"

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
