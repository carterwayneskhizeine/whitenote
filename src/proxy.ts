import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Agent 友好的分享链接约定（/share 是公开路由，放行前先改写）──────────────
  // 1. Cloudflare 约定 — URL 加 `.md` 后缀即返回 Markdown：
  //      /share/{id}.md          →  /share/{id}/markdown
  //      /share/comment/{id}.md  →  /share/comment/{id}/markdown
  // 2. Mintlify 约定 — Accept 头带 text/markdown 即返回 Markdown（内容协商）：
  //      GET /share/{id}[...] + Accept: text/markdown  →  同路径 + /markdown
  // 两者都复用对应目录下的 markdown 路由，一次请求拿到整个对话。
  // 浏览器发送的 Accept 是 text/html,... 不含 text/markdown，人看到的仍是 HTML 页。
  const commentMdMatch = pathname.match(/^\/share\/comment\/([^/]+?)\.md$/)
  if (commentMdMatch) {
    const url = request.nextUrl.clone()
    url.pathname = `/share/comment/${commentMdMatch[1]}/markdown`
    return NextResponse.rewrite(url)
  }
  const mdMatch = pathname.match(/^\/share\/([^/]+?)\.md$/)
  if (mdMatch) {
    const url = request.nextUrl.clone()
    url.pathname = `/share/${mdMatch[1]}/markdown`
    return NextResponse.rewrite(url)
  }
  if (
    /^\/share\/[^/.]+$/.test(pathname) ||
    /^\/share\/comment\/[^/.]+$/.test(pathname)
  ) {
    const accept = request.headers.get("accept") ?? ""
    if (accept.includes("text/markdown")) {
      const url = request.nextUrl.clone()
      url.pathname = `${pathname}/markdown`
      return NextResponse.rewrite(url)
    }
  }

  // ── 登录门禁 ──────────────────────────────────────────────────────────────
  // NextAuth v5 uses authjs.session-token (dev) or __secure-authjs.session-token (prod)
  const isLoggedIn = request.cookies.get("authjs.session-token") ||
                     request.cookies.get("__Secure-authjs.session-token") ||
                     request.cookies.get("next-auth.session-token") ||
                     request.cookies.get("__Secure-next-auth.session-token")

  const isAuthPage = pathname.startsWith("/login") ||
                     pathname.startsWith("/register")

  const isApiRoute = pathname.startsWith("/api")

  // 公开路由 - 不需要认证
  const isPublicRoute = pathname.startsWith("/share") ||
                        pathname.startsWith("/api/public")

  if (isApiRoute || isPublicRoute) {
    return NextResponse.next()
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/register", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
