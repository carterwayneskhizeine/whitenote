import { enqueue } from "./simple"

export type JobType =
  | "auto-tag"
  | "auto-tag-comment"
  | "sync-ragflow"
  | "sync-to-local"
  | "create-workspace-from-folder"
  | "create-message-from-file"

export async function addTask<T>(
  type: JobType,
  data: T,
  options?: { delay?: number; priority?: number; jobId?: string }
) {
  enqueue(type, data, { delay: options?.delay })
}

export async function addCronTask<T>(_type: JobType, _data: T, _cronPattern: string) {
  // cron tasks removed (daily-briefing was the only user)
}
