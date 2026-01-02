# WhiteNote 2.5 后端开发指南 - Stage 6: AI 集成 (热更新配置)

> **前置文档**: [Stage 5: Tags/Comments/Templates API](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_05_OTHER_API.md)  
> **下一步**: [Stage 7: 后台任务队列](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_07_WORKERS.md)

---

## 目标

实现 AI 功能集成，包括标准模式和 RAG 模式，**支持配置热更新**（无需重启服务即可生效）。

---

## 配置热更新原则

> [!IMPORTANT]
> **RAGFlow 和 AI 配置支持实时热更新**
> - 每次 AI 调用都从数据库读取最新配置
> - 更新配置 API 后立即生效
> - 不需要重启服务器

---

## RAGFlow 配置信息示例

```
RAGFlow 服务地址: http://localhost:4154
API Key: ragflow-61LVcg1JlwvJPHPmDLEHiw5NWfG6-QUvWShJ6gcbQSc
Chat ID: 1c4db240e66011f09080b2cef1c18441
Dataset ID: 96b74969e65411f09f5fb2cef1c18441
```

---

## Step 1: 更新数据库 Schema

确保 `prisma/schema.prisma` 中的 `AiConfig` 包含 RAGFlow 字段：

```prisma
model AiConfig {
  id String @id @default(cuid())

  // --- 用户关联 (多租户隔离) ---
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId   String @unique  // 每个用户只有一条配置

  // --- 基础 OpenAI 连接 ---
  openaiBaseUrl String @default("http://localhost:4000")
  openaiApiKey  String @default("")
  openaiModel   String @default("gpt-3.5-turbo")

  // --- RAG 模式 ---
  enableRag          Boolean   @default(false)
  ragTimeFilterStart DateTime?
  ragTimeFilterEnd   DateTime?

  // --- RAGFlow 配置 (热更新) ---
  ragflowBaseUrl   String @default("http://localhost:4154")
  ragflowApiKey    String @default("")
  ragflowChatId    String @default("")
  ragflowDatasetId String @default("")

  // --- 自动化 ---
  enableAutoTag  Boolean @default(true)
  autoTagModel   String  @default("gpt-3.5-turbo")
  enableBriefing Boolean @default(true)
  briefingModel  String  @default("gpt-3.5-turbo")
  briefingTime   String  @default("08:00")

  // --- AI 人设 ---
  aiPersonality String  @default("friendly")
  aiExpertise   String?

  enableLinkSuggestion Boolean @default(true)

  updatedAt DateTime @updatedAt
}
```

> [!IMPORTANT]
> **多用户模式**：每个用户拥有独立的 AI 配置，通过 `userId` 字段关联。这确保：
> - 用户可以使用自己的 API Key
> - AI 人设配置互不干扰
> - 成本和隐私完全隔离

运行迁移：
```bash
pnpm prisma migrate dev --name add_ragflow_config
```

---

## Step 2: 创建配置服务（热更新核心）

创建 `src/lib/ai/config.ts`：

```typescript
import { prisma } from "@/lib/prisma"

// 用户级别配置缓存 (key = userId)
const configCache = new Map<string, {
  data: Awaited<ReturnType<typeof getAiConfigFromDb>>
  timestamp: number
}>()

const CACHE_TTL = 5000 // 5 秒缓存，保证热更新响应速度

/**
 * 从数据库获取用户的 AI 配置
 */
async function getAiConfigFromDb(userId: string) {
  let config = await prisma.aiConfig.findUnique({
    where: { userId },
  })

  // 如果用户没有配置，创建默认配置
  if (!config) {
    config = await prisma.aiConfig.create({
      data: { userId },
    })
  }

  return config
}

/**
 * 获取用户的 AI 配置 (带短时缓存)
 * @param userId 当前用户 ID
 */
export async function getAiConfig(userId: string) {
  const now = Date.now()
  const cached = configCache.get(userId)
  
  // 缓存有效，直接返回
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // 缓存过期，从数据库获取
  const config = await getAiConfigFromDb(userId)
  configCache.set(userId, {
    data: config,
    timestamp: now,
  })

  return config
}

/**
 * 清除用户的配置缓存 (配置更新后调用)
 */
export function invalidateConfigCache(userId: string) {
  configCache.delete(userId)
}

/**
 * 更新用户的 AI 配置
 * @param userId 当前用户 ID
 * @param data 要更新的配置字段
 */
export async function updateAiConfig(userId: string, data: Partial<{
  openaiBaseUrl: string
  openaiApiKey: string
  openaiModel: string
  enableRag: boolean
  ragflowBaseUrl: string
  ragflowApiKey: string
  ragflowChatId: string
  ragflowDatasetId: string
  enableAutoTag: boolean
  autoTagModel: string
  enableBriefing: boolean
  briefingModel: string
  briefingTime: string
  aiPersonality: string
  aiExpertise: string | null
}>) {
  const config = await prisma.aiConfig.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })

  // 清除缓存，确保下次调用获取最新配置
  invalidateConfigCache(userId)

  return config
}
```

---

## Step 3: 创建 OpenAI 服务

创建 `src/lib/ai/openai.ts`：

```typescript
import { getAiConfig } from "./config"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatOptions {
  userId: string  // 必须传入用户 ID
  messages: ChatMessage[]
  model?: string // 可选：覆盖默认模型
  stream?: boolean
}

/**
 * 调用 OpenAI 兼容接口 (标准模式)
 * 每次调用都读取用户的最新配置 (热更新)
 */
export async function callOpenAI(options: ChatOptions): Promise<string> {
  // 获取用户的配置
  const config = await getAiConfig(options.userId)

  if (!config.openaiApiKey) {
    throw new Error("OpenAI API key not configured")
  }

  const response = await fetch(`${config.openaiBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: options.model || config.openaiModel,
      messages: options.messages,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ""
}

/**
 * 构建 AI 人设系统提示词 (热更新)
 * @param userId 用户 ID
 */
export async function buildSystemPrompt(userId: string): Promise<string> {
  const config = await getAiConfig(userId)

  const personalities: Record<string, string> = {
    friendly: "你是一个友好、热情的 AI 助手，语气亲切自然。",
    professional: "你是一个专业、严谨的 AI 助手，回答准确简洁。",
    casual: "你是一个轻松、幽默的 AI 伙伴，喜欢用轻松的方式交流。",
  }

  let prompt = personalities[config.aiPersonality] || personalities.friendly
  prompt += " 你是用户的第二大脑助手 @goldierill。"

  if (config.aiExpertise) {
    prompt += ` 你在 ${config.aiExpertise} 领域有深入的了解。`
  }

  return prompt
}
```

---

## Step 4: 创建 RAGFlow 服务 (热更新)

创建 `src/lib/ai/ragflow.ts`：

```typescript
import { getAiConfig } from "./config"

interface RAGFlowMessage {
  role: "user" | "assistant"
  content: string
}

interface RAGFlowResponse {
  choices: Array<{
    message: {
      content: string
      reference?: {
        chunks: Record<string, {
          content: string
          document_name: string
          similarity: number
        }>
      }
    }
  }>
}

/**
 * 调用 RAGFlow OpenAI 兼容接口
 * 配置从数据库实时读取 (热更新)
 */
export async function callRAGFlow(
  messages: RAGFlowMessage[]
): Promise<{ content: string; references?: Array<{ content: string; source: string }> }> {
  // 每次调用获取最新配置 (热更新核心)
  const config = await getAiConfig()

  if (!config.ragflowApiKey) {
    throw new Error("RAGFlow API key not configured")
  }

  if (!config.ragflowChatId) {
    throw new Error("RAGFlow Chat ID not configured")
  }

  const response = await fetch(
    `${config.ragflowBaseUrl}/api/v1/chats_openai/${config.ragflowChatId}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.ragflowApiKey}`,
      },
      body: JSON.stringify({
        model: "model",
        messages,
        stream: false,
        extra_body: {
          reference: true,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`RAGFlow API error: ${error}`)
  }

  const data: RAGFlowResponse = await response.json()
  const message = data.choices[0]?.message

  const references = message?.reference?.chunks
    ? Object.values(message.reference.chunks).map((chunk) => ({
        content: chunk.content,
        source: chunk.document_name,
      }))
    : undefined

  return {
    content: message?.content || "",
    references,
  }
}

/**
 * 同步消息到 RAGFlow 知识库 (热更新)
 */
export async function syncToRAGFlow(messageId: string, content: string) {
  const config = await getAiConfig()

  if (!config.ragflowApiKey || !config.ragflowDatasetId) {
    console.warn("RAGFlow not configured, skipping sync")
    return
  }

  try {
    const response = await fetch(
      `${config.ragflowBaseUrl}/api/v1/datasets/${config.ragflowDatasetId}/documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.ragflowApiKey}`,
        },
        body: JSON.stringify({
          name: `message_${messageId}.md`,
          content,
        }),
      }
    )

    if (!response.ok) {
      console.error("Failed to sync to RAGFlow:", await response.text())
    }
  } catch (error) {
    console.error("RAGFlow sync error:", error)
  }
}
```

---

## Step 5: 更新配置 API (支持热更新)

创建 `src/app/api/config/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import { getAiConfig, updateAiConfig, invalidateConfigCache } from "@/lib/ai/config"
import { NextRequest } from "next/server"

/**
 * GET /api/config
 * 获取 AI 配置
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getAiConfig()

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
 * 更新 AI 配置 (立即生效，无需重启)
 */
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // 允许更新的字段
    const allowedFields = [
      "openaiBaseUrl",
      "openaiApiKey",
      "openaiModel",
      "enableRag",
      "ragflowBaseUrl",
      "ragflowApiKey",
      "ragflowChatId",
      "ragflowDatasetId",
      "enableAutoTag",
      "autoTagModel",
      "enableBriefing",
      "briefingModel",
      "briefingTime",
      "aiPersonality",
      "aiExpertise",
      "enableLinkSuggestion",
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const config = await updateAiConfig(updateData)

    return Response.json({
      data: {
        ...config,
        openaiApiKey: config.openaiApiKey ? "***" : "",
        ragflowApiKey: config.ragflowApiKey ? "***" : "",
      },
      message: "Configuration updated successfully. Changes take effect immediately.",
    })
  } catch (error) {
    console.error("Failed to update config:", error)
    return Response.json({ error: "Failed to update config" }, { status: 500 })
  }
}

/**
 * POST /api/config/test
 * 测试 RAGFlow 连接
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getAiConfig()

  try {
    // 测试 RAGFlow 连接
    const response = await fetch(
      `${config.ragflowBaseUrl}/api/v1/datasets`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.ragflowApiKey}`,
        },
      }
    )

    if (response.ok) {
      return Response.json({
        success: true,
        message: "RAGFlow connection successful",
      })
    } else {
      return Response.json({
        success: false,
        error: `RAGFlow returned status ${response.status}`,
      })
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    })
  }
}
```

---

## Step 6: AI 聊天 API

创建 `src/app/api/ai/chat/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAiConfig } from "@/lib/ai/config"
import { buildSystemPrompt, callOpenAI } from "@/lib/ai/openai"
import { callRAGFlow } from "@/lib/ai/ragflow"
import { NextRequest } from "next/server"

/**
 * POST /api/ai/chat
 * AI 聊天接口 (配置热更新)
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { messageId, content } = body

    if (!messageId || !content) {
      return Response.json(
        { error: "messageId and content are required" },
        { status: 400 }
      )
    }

    // 获取消息上下文
    const message = await prisma.message.findUnique({
      where: { id: messageId, authorId: session.user.id },  // 数据隔离
      include: {
        comments: {
          orderBy: { createdAt: "asc" },
          take: 20,
        },
      },
    })

    if (!message) {
      return Response.json({ error: "Message not found" }, { status: 404 })
    }

    // 获取最新配置 (热更新)
    const config = await getAiConfig()

    let aiResponse: string
    let references: Array<{ content: string; source: string }> | undefined

    if (config.enableRag && config.ragflowApiKey && config.ragflowChatId) {
      // RAG 模式
      const messages = [{ role: "user" as const, content }]
      const result = await callRAGFlow(messages)
      aiResponse = result.content
      references = result.references
    } else {
      // 标准模式
      const systemPrompt = await buildSystemPrompt()
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: `原文：${message.content}\n\n用户问题：${content}` },
      ]
      aiResponse = await callOpenAI({ messages })
    }

    // 保存 AI 回复
    const comment = await prisma.comment.create({
      data: {
        content: aiResponse,
        messageId,
        isAIBot: true,
      },
    })

    return Response.json({
      data: { comment, references },
    })
  } catch (error) {
    console.error("AI chat error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "AI service error" },
      { status: 500 }
    )
  }
}
```

---

## Step 7: AI 增强功能 API

创建 `src/app/api/ai/enhance/route.ts`：

```typescript
import { auth } from "@/lib/auth"
import { callOpenAI } from "@/lib/ai/openai"
import { NextRequest } from "next/server"

type EnhanceAction = "summarize" | "translate" | "expand" | "polish"

const prompts: Record<EnhanceAction, (content: string, target?: string) => string> = {
  summarize: (content) =>
    `请总结以下内容的要点，用简洁的中文回复：\n\n${content}`,
  translate: (content, target = "English") =>
    `请将以下内容翻译成 ${target}：\n\n${content}`,
  expand: (content) =>
    `请扩展以下简短内容，使其更加完整和详细：\n\n${content}`,
  polish: (content) =>
    `请润色以下内容，使其更加流畅和专业，保持原意：\n\n${content}`,
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, content, target } = body

    if (!action || !content) {
      return Response.json(
        { error: "action and content are required" },
        { status: 400 }
      )
    }

    if (!prompts[action as EnhanceAction]) {
      return Response.json(
        { error: "Invalid action" },
        { status: 400 }
      )
    }

    const prompt = prompts[action as EnhanceAction](content, target)

    const result = await callOpenAI({
      messages: [
        { role: "system", content: "你是一个专业的文本处理助手。" },
        { role: "user", content: prompt },
      ],
    })

    return Response.json({ data: { result } })
  } catch (error) {
    console.error("AI enhance error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "AI service error" },
      { status: 500 }
    )
  }
}
```

---

## 验证热更新

```bash
# 1. 更新 RAGFlow 配置
curl -X PUT http://localhost:3005/api/config \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "ragflowBaseUrl": "http://localhost:4154",
    "ragflowApiKey": "ragflow-61LVcg1JlwvJPHPmDLEHiw5NWfG6-QUvWShJ6gcbQSc",
    "ragflowChatId": "1c4db240e66011f09080b2cef1c18441",
    "ragflowDatasetId": "96b74969e65411f09f5fb2cef1c18441",
    "enableRag": true
  }'

# 2. 立即测试 (无需重启)
curl -X POST http://localhost:3005/api/ai/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"messageId":"<id>","content":"测试 RAG 模式"}'
```

---

## 下一步

继续 [Stage 7: 后台任务队列](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_07_WORKERS.md)。
