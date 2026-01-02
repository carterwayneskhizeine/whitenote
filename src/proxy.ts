import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  // NextAuth v5 uses authjs.session-token (dev) or __secure-authjs.session-token (prod)
  const isLoggedIn = request.cookies.get("authjs.session-token") ||
                     request.cookies.get("__Secure-authjs.session-token") ||
                     request.cookies.get("next-auth.session-token") ||
                     request.cookies.get("__Secure-next-auth.session-token")

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
                      request.nextUrl.pathname.startsWith("/register")

  const isApiRoute = request.nextUrl.pathname.startsWith("/api")

  if (isApiRoute) {
    return NextResponse.next()
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
