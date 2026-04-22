export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const g = globalThis as { __whitenoteBooted?: boolean }
  if (g.__whitenoteBooted) return
  g.__whitenoteBooted = true

  const { startWorker } = await import('./src/lib/queue/worker')
  startWorker()

  // FileWatcher disabled: use manual sync (本地→DB) via /api/sync/import-all instead
  // To re-enable, set FILE_WATCHER_ENABLED=true and uncomment below:
  // const { startFileWatcher } = await import('./src/lib/file-watcher')
  // startFileWatcher()
}
