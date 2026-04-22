type JobHandler<T = unknown> = (data: T) => Promise<void>

interface QueueJob {
  name: string
  data: unknown
  attempts: number
  maxAttempts: number
  delay: number
}

const handlers = new Map<string, { fn: JobHandler; maxAttempts: number }>()
const queue: QueueJob[] = []
let running = false

async function processJob(job: QueueJob): Promise<void> {
  const entry = handlers.get(job.name)
  if (!entry) {
    console.warn(`[Queue] No handler for job type: ${job.name}`)
    return
  }
  try {
    await entry.fn(job.data)
    console.log(`[Queue] Job completed: ${job.name}`)
  } catch (err) {
    console.error(`[Queue] Job failed: ${job.name}`, err)
    if (job.attempts < job.maxAttempts) {
      const retryDelay = Math.pow(2, job.attempts) * 1000
      if (retryDelay > 0) await new Promise((r) => setTimeout(r, retryDelay))
      const retryJob: QueueJob = { ...job, attempts: job.attempts + 1 }
      return processJob(retryJob)
    }
  }
}

async function drain() {
  if (running) return
  running = true
  while (true) {
    const job = queue.shift()
    if (!job) break
    if (job.delay > 0) await new Promise((r) => setTimeout(r, job.delay))
    await processJob(job)
  }
  running = false
}

export function registerHandler<T>(name: string, handler: JobHandler<T>, options?: { maxAttempts?: number }) {
  handlers.set(name, { fn: handler as JobHandler, maxAttempts: options?.maxAttempts ?? 3 })
}

export function enqueue(name: string, data: unknown, options?: { delay?: number; maxAttempts?: number }) {
  const entry = handlers.get(name)
  const maxAttempts = options?.maxAttempts ?? entry?.maxAttempts ?? 3
  queue.push({
    name,
    data,
    attempts: 0,
    maxAttempts,
    delay: options?.delay ?? 0,
  })
  setImmediate(drain)
}

export function _resetQueue() {
  handlers.clear()
  queue.length = 0
  running = false
}
