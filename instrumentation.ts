export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const g = globalThis as { __whitenoteBooted?: boolean }
  if (g.__whitenoteBooted) return
  g.__whitenoteBooted = true

  const { startWorker } = await import('./src/lib/queue/worker')
  startWorker()

  // Manual sync (本地→DB) via /api/sync/import-all
}
