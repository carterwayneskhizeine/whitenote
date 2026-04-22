import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const baseUrl = process.env.HERMES_API_URL || 'http://localhost:8642'
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return NextResponse.json({ status: 'ok', backend: 'hermes' })
    }
    return NextResponse.json(
      { status: 'error', backend: 'hermes', detail: `HTTP ${res.status}` },
      { status: 502 }
    )
  } catch {
    return NextResponse.json(
      { status: 'offline', backend: 'hermes' },
      { status: 503 }
    )
  }
}
