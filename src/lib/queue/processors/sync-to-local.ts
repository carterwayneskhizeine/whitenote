import { Job } from "bullmq"
import { exportToLocal } from "@/lib/sync-utils"

interface SyncToLocalJobData {
  type: "message" | "comment"
  id: string
}

export async function processSyncToLocal(job: Job<SyncToLocalJobData>) {
  const { type, id } = job.data

  console.log(`[SyncToLocal] Processing ${type}: ${id}`)

  await exportToLocal(type, id)

  console.log(`[SyncToLocal] Completed for ${type}: ${id}`)
}
