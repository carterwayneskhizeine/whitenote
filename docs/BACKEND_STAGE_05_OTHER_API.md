# WhiteNote 2.5 后端开发指南 - Stage 5: Tags/Comments/Templates API

> **前置文档**: [Stage 4: Messages API](./BACKEND_STAGE_04_MESSAGES_API.md)
> **下一步**: [Stage 6: AI 集成](./BACKEND_STAGE_06_AI.md)
> **状态**: ✅ 已完成 (2026-01-02)

---

## 目标

实现标签、评论、模板和搜索 API。

---

## Part 1: Tags API

### 创建 `src/app/api/tags/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/tags
 * 获取所有标签 (含消息数量，按热度排序)
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { messages: true },
      },
    },
    orderBy: {
      messages: { _count: "desc" },
    },
  })

  // 格式化响应
  const formattedTags = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    count: tag._count.messages,
  }))

  return Response.json({ data: formattedTags })
}

/**
 * POST /api/tags
 * 创建新标签
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, color } = body

    if (!name || name.trim() === "") {
      return Response.json({ error: "Name is required" }, { status: 400 })
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color || null,
      },
    })

    return Response.json({ data: tag }, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return Response.json({ error: "Tag already exists" }, { status: 409 })
    }
    throw error
  }
}
```

### 创建 `src/app/api/tags/[id]/messages/route.ts`：

> **注意**: Next.js 16 中，动态路由的 `params` 现在是一个 `Promise`，需要使用 `await` 解析。

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getPaginationParams } from "@/lib/validation"
import { NextRequest } from "next/server"

/**
 * GET /api/tags/[id]/messages
 * 获取标签下的所有消息
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { page, limit, skip } = getPaginationParams(request)

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: {
        authorId: session.user.id,
        tags: { some: { tagId: id } },
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
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.message.count({
      where: {
        authorId: session.user.id,
        tags: { some: { tagId: id } },
      },
    }),
  ])

  return Response.json({
    data: messages,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}
```

---

## Part 2: Comments API

### 创建 `src/app/api/messages/[id]/comments/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/messages/[id]/comments
 * 获取消息的评论列表
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const comments = await prisma.comment.findMany({
    where: { messageId: id },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return Response.json({ data: comments })
}

/**
 * POST /api/messages/[id]/comments
 * 添加评论
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 验证消息存在
  const message = await prisma.message.findUnique({
    where: { id },
  })

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { content } = body

    if (!content || content.trim() === "") {
      return Response.json({ error: "Content is required" }, { status: 400 })
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        messageId: id,
        authorId: session.user.id,
        isAIBot: false,
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
      },
    })

    return Response.json({ data: comment }, { status: 201 })
  } catch (error) {
    console.error("Failed to create comment:", error)
    return Response.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
```

---

## Part 3: Templates API

### 创建 `src/app/api/templates/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/templates
 * 获取所有模板 (内置 + 用户自定义)
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const templates = await prisma.template.findMany({
    where: {
      OR: [
        { isBuiltIn: true },
        { authorId: session.user.id },
      ],
    },
    orderBy: [
      { isBuiltIn: "desc" },
      { name: "asc" },
    ],
  })

  return Response.json({ data: templates })
}

/**
 * POST /api/templates
 * 创建自定义模板
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, content, description } = body

    if (!name || !content) {
      return Response.json(
        { error: "Name and content are required" },
        { status: 400 }
      )
    }

    const template = await prisma.template.create({
      data: {
        name: name.trim(),
        content: content.trim(),
        description: description?.trim() || null,
        authorId: session.user.id,
        isBuiltIn: false,
      },
    })

    return Response.json({ data: template }, { status: 201 })
  } catch (error) {
    console.error("Failed to create template:", error)
    return Response.json({ error: "Failed to create template" }, { status: 500 })
  }
}
```

### 创建 `src/app/api/templates/[id]/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/templates/[id]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.template.findUnique({
    where: { id },
  })

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 })
  }

  return Response.json({ data: template })
}

/**
 * DELETE /api/templates/[id]
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.template.findUnique({
    where: { id },
  })

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 })
  }

  // 保护内置模板
  if (template.isBuiltIn) {
    return Response.json({ error: "Cannot delete built-in template" }, { status: 403 })
  }

  // 验证所有权
  if (template.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.template.delete({ where: { id } })

  return Response.json({ success: true })
}
```

---

## Part 4: Search API

### 创建 `src/app/api/search/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getPaginationParams } from "@/lib/validation"
import { NextRequest } from "next/server"

/**
 * GET /api/search
 * 全局搜索
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query || query.trim() === "") {
    return Response.json({ error: "Query is required" }, { status: 400 })
  }

  const { page, limit, skip } = getPaginationParams(request)

  // 保存搜索历史
  await prisma.searchHistory.create({
    data: { query: query.trim() },
  })

  // 搜索消息
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: {
        authorId: session.user.id,
        content: {
          contains: query.trim(),
          mode: "insensitive",
        },
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
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.message.count({
      where: {
        authorId: session.user.id,
        content: { contains: query.trim(), mode: "insensitive" },
      },
    }),
  ])

  return Response.json({
    data: messages,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}
```

---

## Part 5: AI Config API (用户级别配置)

### 创建 `src/app/api/config/route.ts`：

> **重要改进**: AI Config 现在基于用户级别，每个用户拥有独立的配置记录（基于 `userId`）。

```typescript
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * GET /api/config
 * 获取当前用户的 AI 配置
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let config = await prisma.aiConfig.findUnique({
    where: { userId: session.user.id },
  })

  // 如果不存在，创建默认配置
  if (!config) {
    config = await prisma.aiConfig.create({
      data: {
        userId: session.user.id,
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
  }

  // 隐藏敏感字段
  return Response.json({
    data: {
      ...config,
      openaiApiKey: config.openaiApiKey ? "***" : "",
      ragflowApiKey: config.ragflowApiKey ? "***" : "",
    },
  })
}

/**
 * PUT /api/config
 * 更新当前用户的 AI 配置
 */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // 过滤允许更新的字段
    const allowedFields = [
      "openaiBaseUrl",
      "openaiApiKey",
      "openaiModel",
      "enableRag",
      "ragflowBaseUrl",
      "ragflowApiKey",
      "ragflowChatId",
      "ragflowDatasetId",
      "ragTimeFilterStart",
      "ragTimeFilterEnd",
      "enableAutoTag",
      "autoTagModel",
      "enableBriefing",
      "briefingModel",
      "briefingTime",
      "aiPersonality",
      "aiExpertise",
      "enableLinkSuggestion",
    ]

    const updateData: any = { userId: session.user.id }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const config = await prisma.aiConfig.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: updateData,
    })

    // 隐藏敏感字段
    return Response.json({
      data: {
        ...config,
        openaiApiKey: config.openaiApiKey ? "***" : "",
        ragflowApiKey: config.ragflowApiKey ? "***" : "",
      },
    })
  } catch (error) {
    console.error("Failed to update config:", error)
    return Response.json({ error: "Failed to update config" }, { status: 500 })
  }
}
```

---

## API 端点汇总

| 模块 | 端点 | 方法 | 说明 |
|------|------|------|------|
| **Tags** | `/api/tags` | GET | 获取所有标签 |
| | `/api/tags` | POST | 创建标签 |
| | `/api/tags/[id]/messages` | GET | 获取标签下的消息 |
| **Comments** | `/api/messages/[id]/comments` | GET | 获取评论列表 |
| | `/api/messages/[id]/comments` | POST | 添加评论 |
| **Templates** | `/api/templates` | GET | 获取模板列表 |
| | `/api/templates` | POST | 创建模板 |
| | `/api/templates/[id]` | GET | 模板详情 |
| | `/api/templates/[id]` | DELETE | 删除模板 |
| **Search** | `/api/search?q=` | GET | 全局搜索 |
| **Config** | `/api/config` | GET | AI 配置 |
| | `/api/config` | PUT | 更新 AI 配置 |

---

## 实现要点

### 1. Next.js 16 动态路由变更

**重要**: Next.js 16 改变了动态路由 params 的类型：

```typescript
// ❌ 旧版本 (Next.js 15)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  // ...
}

// ✅ 新版本 (Next.js 16)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params  // 需要 await
  // ...
}
```

### 2. Prisma 默认导入

Prisma Client 使用默认导出而非命名导出：

```typescript
// ✅ 正确
import prisma from "@/lib/prisma"

// ❌ 错误
import { prisma } from "@/lib/prisma"
```

### 3. 多用户数据隔离

所有 API 都遵循数据隔离原则：

```typescript
// 1. 获取当前用户
const session = await auth()
if (!session?.user?.id) {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}

// 2. 查询时过滤用户数据
const messages = await prisma.message.findMany({
  where: {
    authorId: session.user.id,  // 关键：只查询当前用户的数据
  },
})

// 3. 修改/删除时验证所有权
if (template.authorId !== session.user.id) {
  return Response.json({ error: "Forbidden" }, { status: 403 })
}
```

### 4. AI Config 用户级别配置

每个用户拥有独立的 AI 配置记录（基于 `userId`），而非全局单例配置：

```typescript
// 查询当前用户配置
const config = await prisma.aiConfig.findUnique({
  where: { userId: session.user.id },
})

// 创建或更新
const config = await prisma.aiConfig.upsert({
  where: { userId: session.user.id },
  update: updateData,
  create: { userId: session.user.id, ...updateData },
})
```

---

## 额外修复

### 登录页面修复 (src/app/login/page.tsx)

修复了 NextAuth v5 的 `signIn` 调用方式：

```typescript
// ❌ 旧版本
const result = await signIn("credentials", {
  email,
  password,
  redirect: true,
})
if (result?.error) { ... }

// ✅ 新版本
const result = await signIn("credentials", {
  email,
  password,
  redirect: false,  // 手动处理重定向
})
if (result?.error) {
  setError("邮箱或密码错误")
} else if (result?.ok) {
  router.push("/")
  router.refresh()
}
```

---

## 验证检查点

### 构建验证

```bash
# 1. 构建项目
pnpm build

# 预期输出:
# ✓ Compiled successfully
# ✓ Running TypeScript ...
# ✓ Collecting page data ...
# ✓ Generating static pages (13/13)
```

### 启动开发服务器

```bash
# 2. 启动开发服务器
pnpm dev

# 3. 访问 http://localhost:3005/login
# 测试账号: owner@whitenote.local / admin123
```

### API 测试

登录后使用浏览器开发者工具测试：

```javascript
// 1. 获取所有标签
fetch('/api/tags')
  .then(r => r.json())
  .then(console.log)

// 2. 创建标签
fetch('/api/tags', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '测试标签', color: '#3B82F6' })
}).then(r => r.json()).then(console.log)

// 3. 获取模板列表
fetch('/api/templates')
  .then(r => r.json())
  .then(console.log)

// 4. 搜索
fetch('/api/search?q=test')
  .then(r => r.json())
  .then(console.log)
```

---

## 文件结构

```
src/app/api/
├── tags/
│   ├── route.ts              # GET /api/tags, POST /api/tags
│   └── [id]/
│       └── messages/
│           └── route.ts      # GET /api/tags/[id]/messages
├── messages/
│   └── [id]/
│       └── comments/
│           └── route.ts      # GET/POST /api/messages/[id]/comments
├── templates/
│   ├── route.ts              # GET/POST /api/templates
│   └── [id]/
│       └── route.ts          # GET/DELETE /api/templates/[id]
├── search/
│   └── route.ts              # GET /api/search
└── config/
    └── route.ts              # GET/PUT /api/config
```

---

## 已知限制

1. **搜索功能**: 目前仅支持 PostgreSQL `contains` 查询，未使用全文索引
2. **标签热度排序**: 按消息数量排序，未考虑时间衰减
3. **搜索历史**: 当前未实现用户级别的搜索历史隔离

---

## 下一步

✅ **Stage 5 完成！**

继续实现 [Stage 6: AI 集成](./BACKEND_STAGE_06_AI.md)，包括：
- 自动打标 (Auto-Tagging)
- 每日晨报 (Daily Briefing)
- RAG 模式 (知识检索增强)
- AI 评论回复

---

*文档最后更新: 2026-01-02*
