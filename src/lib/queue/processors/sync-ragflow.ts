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
