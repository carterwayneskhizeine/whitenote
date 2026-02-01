/**
 * Get the user's comment sort order preference for share pages
 * Reads from localStorage (client-side only)
 */
export function getCommentSortOrder(): boolean {
  if (typeof window === 'undefined') return true // Default: newest first

  try {
    const stored = localStorage.getItem('shareCommentsOrderNewestFirst')
    return stored === null ? true : stored === 'true'
  } catch {
    return true // Default: newest first
  }
}

/**
 * Set the user's comment sort order preference for share pages
 * Stores in localStorage (client-side only)
 */
export function setCommentSortOrder(newestFirst: boolean): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('shareCommentsOrderNewestFirst', String(newestFirst))
  } catch (error) {
    console.error('Failed to save comment sort order:', error)
  }
}
