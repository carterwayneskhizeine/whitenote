/**
 * Cookie name for storing comment sort order preference
 */
const COOKIE_NAME = 'shareCommentsOrderNewestFirst'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year in seconds

/**
 * Get the user's comment sort order preference for share pages
 * Reads from cookie (works in incognito mode too)
 */
export function getCommentSortOrder(): boolean {
  if (typeof window === 'undefined') return true // Default: newest first

  try {
    // Read from cookie
    const cookies = document.cookie.split(';')
    const cookie = cookies.find(c => c.trim().startsWith(`${COOKIE_NAME}=`))

    if (cookie) {
      const value = cookie.split('=')[1]?.trim()
      return value === 'true'
    }

    // Fallback to localStorage for backwards compatibility
    const stored = localStorage.getItem('shareCommentsOrderNewestFirst')
    return stored === null ? true : stored === 'true'
  } catch {
    return true // Default: newest first
  }
}

/**
 * Set the user's comment sort order preference for share pages
 * Stores in both cookie and localStorage (cookie works in incognito mode)
 */
export function setCommentSortOrder(newestFirst: boolean): void {
  if (typeof window === 'undefined') return

  try {
    // Set cookie (works in incognito mode with expiration)
    document.cookie = `${COOKIE_NAME}=${String(newestFirst)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`

    // Also save to localStorage for backup
    localStorage.setItem('shareCommentsOrderNewestFirst', String(newestFirst))
  } catch (error) {
    console.error('Failed to save comment sort order:', error)
  }
}
