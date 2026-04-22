type JobHandler<T = unknown> = (data: T) => Promise<void>

interface QueueJob {
  name: string
  data: unknown
  attempts: number
  maxAttempts: number
  delay: number
}

const handlers = new Map<string, JobHandler>()
const queue: QueueJob[] = []
let running = false

async function drain() {
  if (running) return
  running = true
  while (queue.length > 0) {
    const job = queue.shift()!
    if (job.delay > 0) {
      await new Promise((r) => setTimeout(r, job.delay))
    }
    const handler = handlers.get(job.name)
    if (!handler) {
      console.warn(`[Queue] No handler for job type: ${job.name}`)
      continue
    }
    try {
      await handler(job.data)
      console.log(`[Queue] Job completed: ${job.name}`)
    } catch (err) {
      console.error(`[Queue] Job failed: ${job.name}`, err)
      if (job.attempts < job.maxAttempts) {
        const retryDelay = Math.pow(2, job.attempts) * 1000
        queue.push({ ...job, attempts: job.attempts + 1, delay: retryDelay })
      }
    }
  }
  running = false
}

export function registerHandler<T>(name: string, handler: JobHandler<T>) {
  handlers.set(name, handler as JobHandler)
}

export function enqueue(name: string, data: unknown, options?: { delay?: number; maxAttempts?: number }) {
  queue.push({
    name,
    data,
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? 3,
    delay: options?.delay ?? 0,
  })
  setImmediate(drain)
}
