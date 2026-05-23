type JobHandler<T = unknown> = (data: T) => Promise<void>

interface QueueJob {
  name: string
  data: unknown
  attempts: number
  maxAttempts: number
  delay: number
}

// Use globalThis so state is shared across Next.js bundled API routes and instrumentation context
const g = globalThis as {
  __queueHandlers?: Map<string, { fn: JobHandler; maxAttempts: number }>
  __queueJobs?: QueueJob[]
  __queueRunning?: boolean
}
if (!g.__queueHandlers) g.__queueHandlers = new Map()
if (!g.__queueJobs) g.__queueJobs = []
if (g.__queueRunning === undefined) g.__queueRunning = false

const handlers = g.__queueHandlers
const queue = g.__queueJobs

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
  if (g.__queueRunning) return
  g.__queueRunning = true
  while (true) {
    const job = queue.shift()
    if (!job) break
    if (job.delay > 0) await new Promise((r) => setTimeout(r, job.delay))
    await processJob(job)
  }
  g.__queueRunning = false
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
  g.__queueRunning = false
}
