import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/socket
 * Socket.io route placeholder (actual handling done by custom server)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Socket.io server is running on the custom server",
    path: "/api/socket",
  })
}
