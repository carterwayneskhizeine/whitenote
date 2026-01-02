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
