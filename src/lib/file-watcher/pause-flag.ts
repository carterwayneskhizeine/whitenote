const pauseExpiry = new Map<string, number>()

export function setPaused(key: string, ttlMs: number) {
  pauseExpiry.set(key, Date.now() + ttlMs)
}

export function isPaused(key: string): boolean {
  const expiry = pauseExpiry.get(key)
  if (!expiry) return false
  if (Date.now() > expiry) {
    pauseExpiry.delete(key)
    return false
  }
  return true
}

export function clearPaused(key: string) {
  pauseExpiry.delete(key)
}
