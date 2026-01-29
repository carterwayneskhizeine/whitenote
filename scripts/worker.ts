import "dotenv/config"
import { startWorker } from "@/lib/queue/worker"
import { addCronTask } from "@/lib/queue"
import { startFileWatcher, stopFileWatcher } from "@/lib/file-watcher"
import Redis from "ioredis"

async function main() {
  console.log("Starting WhiteNote Worker...")

  // 启动 Worker
  const worker = startWorker()

  // 启动文件监听器
  if (process.env.FILE_WATCHER_ENABLED !== "false") {
    startFileWatcher()
    console.log("File watcher started")
  } else {
    console.log("File watcher disabled (set FILE_WATCHER_ENABLED=true to enable)")
  }

  // 注册每日晨报定时任务 (每天早上 8:00)
  await addCronTask("daily-briefing", {}, "0 8 * * *")
  console.log("Registered daily briefing cron job (every day at 08:00)")

  // 在 Redis 中标记 Worker 为运行状态
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:16379'
  const redis = new Redis(redisUrl)
  const workerStatusKey = 'worker:status'

  // 写入 Worker 状态（包含启动时间）
  await redis.set(workerStatusKey, JSON.stringify({
    running: true,
    startedAt: new Date().toISOString(),
    pid: process.pid
  }))
  console.log('[Worker] Status written to Redis')

  // 优雅退出
  process.on("SIGTERM", async () => {
    console.log("Shutting down worker...")
    // 删除 Worker 状态标记
    await redis.del(workerStatusKey)
    await redis.quit()
    await worker.close()
    stopFileWatcher()
    process.exit(0)
  })

  console.log("Worker is running. Press Ctrl+C to exit.")
}

main().catch(console.error)
