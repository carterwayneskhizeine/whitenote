import { proxy } from "./proxy"

export function middleware(request: any) {
  return proxy(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
