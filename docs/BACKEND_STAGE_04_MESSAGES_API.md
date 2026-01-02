# WhiteNote 2.5 后端开发指南 - Stage 4: Messages API

> **前置文档**: [Stage 3: 认证系统](./BACKEND_STAGE_03_AUTH.md)
> **下一步**: [Stage 5: Tags/Comments/Templates API](./BACKEND_STAGE_05_OTHER_API.md)
> **测试指南**: [API 测试指南](./API_TEST_GUIDE.md)

---

## 目标

实现 Messages 核心 API，包括创建、读取、更新、删除、收藏和置顶功能。

---

## API 端点概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/messages` | GET | 获取消息列表 (时间线) |
| `/api/messages` | POST | 创建新消息 |
| `/api/messages/[id]` | GET | 获取单条消息详情 |
| `/api/messages/[id]` | PUT | 更新消息 |
| `/api/messages/[id]` | DELETE | 删除消息 |
| `/api/messages/[id]/star` | POST | 切换收藏状态 |
| `/api/messages/[id]/pin` | POST | 切换置顶状态 |

---

## Step 1: 创建类型定义

创建 `src/types/api.ts`：

```typescript
// 分页参数
export interface PaginationParams {
  page?: number
  limit?: number
}

// 消息过滤参数
export interface MessageFilters {
  tagId?: string
  isStarred?: boolean
  isPinned?: boolean
  parentId?: string | null  // null = 仅根消息
  search?: string
}

// 创建消息参数
export interface CreateMessageInput {
  content: string
  parentId?: string
  tags?: string[]  // 标签名称数组
}

// 更新消息参数
export interface UpdateMessageInput {
  content?: string
  tags?: string[]
}

// API 响应
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// 消息详情 (包含关联数据)
export interface MessageWithRelations {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
  isStarred: boolean
  isPinned: boolean
  authorId: string
  parentId: string | null
  author: {
    id: string
    name: string | null
    avatar: string | null
  }
  tags: Array<{
    tag: {
      id: string
      name: string
      color: string | null
    }
  }>
  _count: {
    children: number
    comments: number
  }
}
```

---

## Step 2: 创建请求验证工具

创建 `src/lib/validation.ts`：

```typescript
import { NextRequest } from "next/server"

/**
 * 解析分页参数
 */
export function getPaginationParams(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * 验证必填字段
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): string | null {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      return `Field '${String(field)}' is required`
    }
  }
  return null
}
```

---

## Step 3: 创建 Messages 列表 API

创建 `src/app/api/messages/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPaginationParams } from "@/lib/validation"
import { NextRequest } from "next/server"

/**
 * GET /api/messages
 * 获取消息列表 (时间线)
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { page, limit, skip } = getPaginationParams(request)
  const searchParams = request.nextUrl.searchParams

  // 解析过滤参数
  const tagId = searchParams.get("tagId")
  const isStarred = searchParams.get("isStarred") === "true" ? true : undefined
  const isPinned = searchParams.get("isPinned") === "true" ? true : undefined
  const parentId = searchParams.get("parentId")
  const rootOnly = searchParams.get("rootOnly") === "true"

  // 构建查询条件
  const where: Record<string, unknown> = {
    authorId: session.user.id,
  }

  if (tagId) {
    where.tags = { some: { tagId } }
  }
  if (isStarred !== undefined) {
    where.isStarred = isStarred
  }
  if (isPinned !== undefined) {
    where.isPinned = isPinned
  }
  if (parentId) {
    where.parentId = parentId
  } else if (rootOnly) {
    where.parentId = null
  }

  // 查询消息
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: { children: true, comments: true },
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.message.count({ where }),
  ])

  return Response.json({
    data: messages,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
}

/**
 * POST /api/messages
 * 创建新消息
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { content, parentId, tags } = body

    if (!content || content.trim() === "") {
      return Response.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    // 验证父消息存在 (如果指定)
    if (parentId) {
      const parent = await prisma.message.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        return Response.json(
          { error: "Parent message not found" },
          { status: 404 }
        )
      }
    }

    // 创建消息
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        authorId: session.user.id,
        parentId: parentId || null,
        // 创建或关联标签
        tags: tags?.length
          ? {
              create: await Promise.all(
                tags.map(async (tagName: string) => {
                  const tag = await prisma.tag.upsert({
                    where: { name: tagName },
                    create: { name: tagName },
                    update: {},
                  })
                  return { tagId: tag.id }
                })
              ),
            }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: { children: true, comments: true },
        },
      },
    })

    return Response.json({ data: message }, { status: 201 })
  } catch (error) {
    console.error("Failed to create message:", error)
    return Response.json(
      { error: "Failed to create message" },
      { status: 500 }
    )
  }
}
```

---

## Step 4: 创建单条消息 API

创建 `src/app/api/messages/[id]/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/messages/[id]
 * 获取单条消息详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const message = await prisma.message.findUnique({
    where: { id: params.id },
    include: {
      author: {
        select: { id: true, name: true, avatar: true },
      },
      tags: {
        include: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      children: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          _count: { select: { children: true, comments: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      incomingLinks: {
        include: {
          source: {
            select: { id: true, content: true },
          },
        },
      },
      _count: {
        select: { children: true, comments: true, versions: true },
      },
    },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  // 权限检查
  if (message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return Response.json({ data: message })
}

/**
 * PUT /api/messages/[id]
 * 更新消息
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existing = await prisma.message.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  if (existing.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { content, tags } = body

    // 保存版本历史
    if (content && content !== existing.content) {
      await prisma.messageVersion.create({
        data: {
          messageId: params.id,
          content: existing.content,
        },
      })
    }

    // 更新消息
    const message = await prisma.message.update({
      where: { id: params.id },
      data: {
        content: content?.trim() || existing.content,
        // 更新标签 (如果提供)
        tags: tags
          ? {
              deleteMany: {},
              create: await Promise.all(
                tags.map(async (tagName: string) => {
                  const tag = await prisma.tag.upsert({
                    where: { name: tagName },
                    create: { name: tagName },
                    update: {},
                  })
                  return { tagId: tag.id }
                })
              ),
            }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: { select: { children: true, comments: true } },
      },
    })

    return Response.json({ data: message })
  } catch (error) {
    console.error("Failed to update message:", error)
    return Response.json(
      { error: "Failed to update message" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/messages/[id]
 * 删除消息
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existing = await prisma.message.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  if (existing.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.message.delete({
    where: { id: params.id },
  })

  return Response.json({ success: true })
}
```

---

## Step 5: 创建收藏/置顶 API

创建 `src/app/api/messages/[id]/star/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/messages/[id]/star
 * 切换收藏状态
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const message = await prisma.message.findUnique({
    where: { id: params.id },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  if (message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.message.update({
    where: { id: params.id },
    data: { isStarred: !message.isStarred },
    select: { id: true, isStarred: true },
  })

  return Response.json({ data: updated })
}
```

创建 `src/app/api/messages/[id]/pin/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/messages/[id]/pin
 * 切换置顶状态
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const message = await prisma.message.findUnique({
    where: { id: params.id },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  if (message.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.message.update({
    where: { id: params.id },
    data: { isPinned: !message.isPinned },
    select: { id: true, isPinned: true },
  })

  return Response.json({ data: updated })
}
```

---

## 测试文件说明

在开发阶段创建了以下测试文件，用于验证 API 功能：

### 浏览器测试工具
- **`public/test-api.html`** - 可视化 API 测试页面
  - 提供表单界面测试所有 API 端点
  - 实时显示请求/响应
  - 包含用户状态检查
  - **访问地址**: http://localhost:3005/test-api.html

### 命令行测试脚本
- **`scripts/test-api.mjs`** - Node.js 自动化测试脚本
  - 自动注册/登录流程
  - 测试所有 API 端点
  - 显示详细的错误信息

### 测试文档
- **`docs/API_TEST_GUIDE.md`** - 完整的 API 测试指南
  - 浏览器测试步骤
  - cURL 命令示例
  - 数据库验证方法
  - 故障排查指南

### 清理测试文件

**测试通过后，可以删除以下临时测试文件**：

```bash
# 删除命令行测试脚本
rm scripts/test-api.mjs

# 删除浏览器测试页面（保留 API 测试指南文档）
rm public/test-api.html
rm scripts/test-api.html
```

**保留文件**：
- ✅ `docs/API_TEST_GUIDE.md` - 保留作为文档参考

---

## 验证检查点

### 使用浏览器测试页面（推荐）⭐

1. **启动开发服务器**：
   ```bash
   pnpm dev
   ```

2. **访问登录页面**：http://localhost:3005/login

3. **使用测试账号登录**：
   - 邮箱: `owner@whitenote.local`
   - 密码: `admin123`

4. **登录成功后，访问 API 测试页面**：http://localhost:3005/test-api.html

5. **在测试页面中测试所有 API 端点**：
   - ✅ 创建消息（带标签）
   - ✅ 获取消息列表（支持分页、过滤）
   - ✅ 获取单条消息详情
   - ✅ 更新消息（自动保存版本历史）
   - ✅ 切换收藏/置顶状态
   - ✅ 删除消息

### 使用 cURL 测试

如果你想使用命令行测试，请先获取 session cookie（从浏览器开发者工具中复制），然后：

```bash
# 设置环境变量
export SESSION_TOKEN="你的session_token值"

# 1. 创建消息
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=$SESSION_TOKEN" \
  -d '{"content":"Hello WhiteNote!","tags":["test","first"]}'

# 2. 获取时间线
curl http://localhost:3005/api/messages \
  -H "Cookie: authjs.session-token=$SESSION_TOKEN"

# 3. 获取单条消息
curl http://localhost:3005/api/messages/<message-id> \
  -H "Cookie: authjs.session-token=$SESSION_TOKEN"

# 4. 收藏消息
curl -X POST http://localhost:3005/api/messages/<message-id>/star \
  -H "Cookie: authjs.session-token=$SESSION_TOKEN"
```

> **注意**：开发服务器默认运行在端口 3005 。请根据实际情况调整端口号。

### 验证数据库

```bash
# 查看最新消息
docker exec pg16 psql -U myuser -d whitenote -c "
  SELECT id, LEFT(content, 50) as preview, \"isStarred\", \"isPinned\"
  FROM \"Message\"
  ORDER BY \"createdAt\" DESC
  LIMIT 5;
"
```

---

## 配置说明

### Proxy 配置（Route Handler）

本项目使用 `src/proxy.ts` 替代传统的 middleware，用于路由保护和认证检查：

```typescript
// src/proxy.ts
export function proxy(request: NextRequest) {
  // 检查 NextAuth v5 的 session cookie
  const isLoggedIn = request.cookies.get("authjs.session-token") ||
                     request.cookies.get("__Secure-authjs.session-token")

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
                      request.nextUrl.pathname.startsWith("/register")

  const isApiRoute = request.nextUrl.pathname.startsWith("/api")

  // API 路由不需要认证检查（由各个 API 自己处理）
  if (isApiRoute) {
    return NextResponse.next()
  }

  // 已登录用户访问登录页 → 重定向到首页
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // 未登录用户访问非公开页面 → 重定向到登录页
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}
```

**配置文件**：
- `src/proxy.ts` - 路由保护逻辑
- `next.config.ts` - 注册 proxy handler

### NextAuth v5 Cookie 名称

NextAuth v5 使用不同的 cookie 名称：

| 环境 | Cookie 名称 |
|------|-------------|
| 开发环境 | `authjs.session-token` |
| 生产环境（HTTPS） | `__Secure-authjs.session-token` |

兼容旧版本：
- `next-auth.session-token`（v4）
- `__Secure-next-auth.session-token`（v4）

---

## 故障排查

### 问题 1: 登录后立即重定向回登录页

**原因**：`NEXTAUTH_URL` 环境变量与实际端口不匹配

**解决方案**：
1. 检查 `.env` 文件中的 `NEXTAUTH_URL`
2. 确保端口号与实际运行的端口一致（如 `http://localhost:3005`）
3. 重启开发服务器

### 问题 2: API 返回 401 Unauthorized

**原因**：未登录或 session token 过期

**解决方案**：
1. 访问 http://localhost:3005/login 重新登录
2. 检查浏览器开发者工具中的 cookies 是否包含 `authjs.session-token`

### 问题 3: 创建消息失败

**原因**：数据库连接问题或权限问题

**解决方案**：
```bash
# 检查数据库是否运行
docker ps | grep pg16

# 检查数据库连接
docker exec pg16 psql -U myuser -d whitenote -c "SELECT 1"
```

---

## 下一步

✅ Stage 4 完成！

继续实现 [Stage 5: Tags/Comments/Templates API](./BACKEND_STAGE_05_OTHER_API.md)。

或查看完整的 [API 测试指南](./API_TEST_GUIDE.md)。
