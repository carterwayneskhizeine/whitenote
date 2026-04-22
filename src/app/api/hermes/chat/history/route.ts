import { NextRequest, NextResponse } from 'next/server'

const DASHBOARD_URL = process.env.HERMES_DASHBOARD_URL || 'http://localhost:9119'

let cachedToken: string | null = null
let tokenFetchedAt = 0
const TOKEN_TTL = 5 * 60 * 1000

async function getSessionToken(): Promise<string | null> {
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL) {
    return cachedToken
  }
  try {
    const res = await fetch(DASHBOARD_URL, {
      signal: AbortSignal.timeout(5000),
    })
    const html = await res.text()
    const match = html.match(/window\.__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/)
    if (match) {
      cachedToken = match[1]
      tokenFetchedAt = Date.now()
      return cachedToken
    }
  } catch (e) {
    console.error('[Hermes History] Failed to fetch session token:', e)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 })
    }

    const token = await getSessionToken()
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to obtain Hermes dashboard token' },
        { status: 503 }
      )
    }

    const res = await fetch(
      `${DASHBOARD_URL}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) {
      if (res.status === 401) cachedToken = null
      const errText = await res.text().catch(() => res.statusText)
      return NextResponse.json(
        { error: `Hermes error: ${res.status} ${errText}` },
        { status: res.status }
      )
    }

    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[Hermes History] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
