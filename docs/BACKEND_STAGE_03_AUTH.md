# WhiteNote 2.5 后端开发指南 - Stage 3: 认证系统 (多用户版)

> **前置文档**: [Stage 2: 数据库 Schema](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_02_DATABASE.md)  
> **下一步**: [Stage 4: Messages API](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_04_MESSAGES_API.md)

---

## 目标

使用 NextAuth.js 实现**多用户认证系统**，支持用户注册、登录，确保用户数据隔离。

---

## Step 1: 安装依赖

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

> **注意**：由于 bcryptjs 依赖 Node.js crypto 模块，所有使用 NextAuth 的 API routes 必须设置 `export const runtime = 'nodejs'`

---

## Step 2: 创建 NextAuth 配置

创建 `src/lib/auth.ts`：

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
```

---

## Step 3: 创建用户注册 API

创建 `src/app/api/auth/register/route.ts`：

```typescript
import { hash } from "bcryptjs"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

/**
 * POST /api/auth/register
 * 用户注册
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // 验证必填字段
    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // 验证密码长度
    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return Response.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    // 创建用户
    const passwordHash = await hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || email.split("@")[0],
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    // 为新用户创建默认 AI 配置
    await prisma.aiConfig.create({
      data: {
        userId: user.id,
        openaiBaseUrl: process.env.OPENAI_BASE_URL || "http://localhost:4000",
        openaiApiKey: process.env.OPENAI_API_KEY || "",
        openaiModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        autoTagModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        briefingModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        ragflowBaseUrl: process.env.RAGFLOW_BASE_URL || "http://localhost:4154",
        ragflowApiKey: process.env.RAGFLOW_API_KEY || "",
        ragflowChatId: process.env.RAGFLOW_CHAT_ID || "",
        ragflowDatasetId: process.env.RAGFLOW_DATASET_ID || "",
      },
    })

    return Response.json({ data: user }, { status: 201 })
  } catch (error) {
    console.error("Registration error:", error)
    return Response.json(
      { error: "Registration failed" },
      { status: 500 }
    )
  }
}
```

---

## Step 4: 创建 Auth API Route

创建 `src/app/api/auth/[...nextauth]/route.ts`：

```typescript
import { handlers } from "@/lib/auth"

export const runtime = 'nodejs'

export const { GET, POST } = handlers
```

---

## Step 5: 扩展 Session 类型

创建 `src/types/next-auth.d.ts`：

```typescript
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}
```

---

## Step 6: 创建认证辅助函数

创建 `src/lib/auth-utils.ts`：

```typescript
import { auth } from "./auth"
import { prisma } from "./prisma"

/**
 * 获取当前登录用户 (用于 Server Components)
 */
export async function getCurrentUser() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
    },
  })

  return user
}

/**
 * 确保用户已登录 (用于 API Routes)
 * 返回用户 ID 用于数据隔离
 */
export async function requireAuth() {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  return {
    userId: session.user.id,
    user: session.user,
  }
}

/**
 * API 响应：未授权
 */
export function unauthorizedResponse() {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401 }
  )
}

/**
 * 验证资源所有权
 * 确保用户只能访问自己的数据
 */
export async function verifyOwnership(
  resourceAuthorId: string,
  currentUserId: string
): boolean {
  return resourceAuthorId === currentUserId
}
```

---

## Step 7: 创建 Auth 中间件 (Proxy)

创建 `src/proxy.ts`：

```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  // 检查 NextAuth session token cookie
  const isLoggedIn = request.cookies.get("next-auth.session-token") ||
                     request.cookies.get("__Secure-next-auth.session-token")

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
                      request.nextUrl.pathname.startsWith("/register")

  const isApiRoute = request.nextUrl.pathname.startsWith("/api")

  // API 路由不受限制
  if (isApiRoute) {
    return NextResponse.next()
  }

  // 已登录用户访问登录/注册页，重定向到首页
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // 未登录用户访问保护页面，重定向到登录页
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

---

## Step 8: 用户资料 API

创建 `src/app/api/auth/me/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

export const runtime = 'nodejs'

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      createdAt: true,
    },
  })

  return Response.json({ data: user })
}

/**
 * PUT /api/auth/me
 * 更新用户资料
 */
export async function PUT(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { name, avatar } = body

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: name || undefined,
        avatar: avatar || undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    })

    return Response.json({ data: user })
  } catch (error) {
    return Response.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
```

---

## 数据隔离原则

> [!IMPORTANT]
> **所有 API 必须遵循数据隔离原则**

在每个 API 中必须：

```typescript
// 1. 获取当前用户
const session = await auth()
if (!session?.user?.id) {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}
const userId = session.user.id

// 2. 查询时过滤用户
const messages = await prisma.message.findMany({
  where: {
    authorId: userId,  // 关键：只查询当前用户的数据
  },
})

// 3. 修改/删除时验证所有权
const message = await prisma.message.findUnique({ where: { id } })
if (message.authorId !== userId) {
  return Response.json({ error: "Forbidden" }, { status: 403 })
}
```

---

## API 端点汇总

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 核心端点 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/auth/me` | PUT | 更新用户资料 |

---

## 常见问题排查

### 1. Edge Runtime 错误

**错误信息**：
```
The edge runtime does not support Node.js 'crypto' module
```

**解决方案**：
在所有使用 `bcryptjs` 或 NextAuth 的 API routes 文件顶部添加：
```typescript
export const runtime = 'nodejs'
```


---

## 验证检查点

```bash
# 1. 测试注册
curl -X POST http://localhost:3005/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456","name":"Test User"}'

# 预期响应
# {"data":{"id":"...","email":"test@example.com","name":"Test User"}}

# 2. 验证数据库
docker exec pg16 psql -U myuser -d whitenote -c "SELECT id, email, name FROM \"User\" ORDER BY \"createdAt\" DESC;"

# 3. 测试登录（需要前端页面或使用 CSRF token）
# 登录通常通过前端表单完成，API 端点为 /api/auth/signin
```

---

## 下一步

完成多用户认证系统后，继续 [Stage 4: Messages API](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_04_MESSAGES_API.md)。
