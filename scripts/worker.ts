import "dotenv/config"
import { startWorker } from "@/lib/queue/worker"
import { addCronTask } from "@/lib/queue"

async function main() {
  console.log("Starting WhiteNote Worker...")

  // 启动 Worker
  const worker = startWorker()

  // 注册每日晨报定时任务 (每天早上 8:00)
  await addCronTask("daily-briefing", {}, "0 8 * * *")
  console.log("Registered daily briefing cron job (every day at 08:00)")

  // 优雅退出
  process.on("SIGTERM", async () => {
    console.log("Shutting down worker...")
    await worker.close()
    process.exit(0)
  })

  console.log("Worker is running. Press Ctrl+C to exit.")
}

main().catch(console.error)
