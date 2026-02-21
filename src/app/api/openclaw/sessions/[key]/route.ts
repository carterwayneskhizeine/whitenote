import { NextRequest, NextResponse } from 'next/server'
import { createGlobalGateway } from '@/lib/openclaw/gateway'

function getOpenClawToken(): string {
  const token = process.env.OPENCLAW_TOKEN
  if (!token) {
    throw new Error('OPENCLAW_TOKEN is not configured')
  }
  return token
}

// PATCH - Update session (rename, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const body = await request.json()
    const { label } = body

    const token = getOpenClawToken()
    const gateway = createGlobalGateway(token)

    if (!gateway.isConnected) {
      return NextResponse.json(
        { error: 'Gateway not connected' },
        { status: 503 }
      )
    }

    // Decode the session key (URL encoded)
    const decodedKey = decodeURIComponent(key)

    const result = await gateway.request<{
      ok: boolean
      path: string
      entry: {
        key: string
        label?: string
      }
    }>('sessions.patch', {
      key: decodedKey,
      label,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[OpenClaw Sessions] Patch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update session' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const searchParams = request.nextUrl.searchParams
    const deleteTranscript = searchParams.get('deleteTranscript') === 'true'

    const token = getOpenClawToken()
    const gateway = createGlobalGateway(token)

    if (!gateway.isConnected) {
      return NextResponse.json(
        { error: 'Gateway not connected' },
        { status: 503 }
      )
    }

    const decodedKey = decodeURIComponent(key)

    // Don't allow deleting the main session
    if (decodedKey === 'main' || decodedKey === 'agent:main:main') {
      return NextResponse.json(
        { error: 'Cannot delete main session' },
        { status: 400 }
      )
    }

    const result = await gateway.request<{
      ok: boolean
      key: string
      deleted: boolean
      archived: string[]
    }>('sessions.delete', {
      key: decodedKey,
      deleteTranscript,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[OpenClaw Sessions] Delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete session' },
      { status: 500 }
    )
  }
}
