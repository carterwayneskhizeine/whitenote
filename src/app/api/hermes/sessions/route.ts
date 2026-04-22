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
    console.error('[Hermes Sessions] Failed to fetch session token:', e)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') || '20'
    const offset = searchParams.get('offset') || '0'

    const token = await getSessionToken()
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to obtain Hermes dashboard token' },
        { status: 503 }
      )
    }

    const res = await fetch(`${DASHBOARD_URL}/api/sessions?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      if (res.status === 401) {
        cachedToken = null
      }
      return NextResponse.json(
        { error: `Hermes dashboard error: ${res.status} ${errText}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Hermes Sessions] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}
