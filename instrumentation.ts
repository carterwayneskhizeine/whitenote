export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const g = globalThis as { __whitenoteBooted?: boolean }
  if (g.__whitenoteBooted) return
  g.__whitenoteBooted = true

  const { startWorker } = await import('./src/lib/queue/worker')
  startWorker()

  if (process.env.FILE_WATCHER_ENABLED !== 'false') {
    const { startFileWatcher } = await import('./src/lib/file-watcher')
    startFileWatcher()
  }
}
