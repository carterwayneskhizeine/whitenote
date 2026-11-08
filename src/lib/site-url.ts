export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://whitenote.goldierill.com").trim().replace(/\/+$/, "")
export const shareUrl = (id: string) => `${SITE_URL}/share/${id}`
