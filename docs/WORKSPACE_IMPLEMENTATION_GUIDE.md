# 多 Workspace 功能实现指南

本文档提供多 Workspace（工作区）功能的实现指南，让用户可以创建多个独立的数据库空间（如 "日常消息"、"编程技术"），每个 Workspace 拥有独立的 RAGFlow 知识库和晨报功能。

---

## 目录

1. [架构概述](#1-架构概述)
2. [AI 助手调用模式](#2-ai-助手调用模式)
3. [数据库模型修改](#3-数据库模型修改)
4. [RAGFlow 自动配置](#4-ragflow-自动配置)
5. [后端 API 修改](#5-后端-api-修改)
6. [队列处理器修改](#6-队列处理器修改)
7. [前端 UI 修改](#7-前端-ui-修改)
8. [跨 Workspace 搜索](#8-跨-workspace-搜索)
9. [数据迁移与清理](#9-数据迁移与清理)

---

## 1. 架构概述

### 当前架构（单 Dataset）
```
User → AiConfig (ragflowDatasetId, ragflowChatId, enableRag) → RAGFlow Dataset
     ↓
     Messages (全部存储在同一个 Dataset)
     
AI 调用：@goldierill （通过 enableRag 开关决定使用 OpenAI 还是 RAGFlow）
```

### 目标架构（多 Workspace + 双提及模式）
```
User → Workspaces[] →  每个 Workspace 拥有:
                       ├── ragflowDatasetId
                       ├── ragflowChatId
                       └── Messages[]
                       
AiConfig 只保留全局配置 (openaiBaseUrl, openaiApiKey, ragflowBaseUrl, ragflowApiKey 等)

AI 调用（两种模式）：
  - @goldierill → OpenAI 直接回答（单帖上下文）
  - @ragflow    → RAGFlow 知识库检索（当前 Workspace 所有消息）
```

### 关键技术栈
- **数据库**: Prisma + PostgreSQL
- **RAGFlow API**: `POST /api/v1/datasets`, `POST /api/v1/chats`
- **队列**: BullMQ + Redis
- **前端状态**: Zustand / React Context

---

## 2. AI 助手调用模式

### 设计变更

移除 `enableRag` 开关，改用两个不同的 @mention 来区分 AI 调用模式：

| 提及 | 模式 | 上下文范围 | 后端调用 |
|------|------|------------|----------|
| `@goldierill` | OpenAI 直接回答 | 单个帖子 | `callOpenAI()` |
| `@ragflow` | RAGFlow 知识库检索 | 当前 Workspace 所有消息 | `callRAGFlowWithChatId()` |

### 后端实现

#### 文件: `src/app/api/ai/chat/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { messageId, content, mode } = await request.json()
  // mode: 'goldierill' | 'ragflow'
  
  const message = await prisma.message.findUnique({
    where: { id: messageId, authorId: session.user.id },
    include: { workspace: true },
  })
  
  let aiResponse: string
  let references: Array<{ content: string; source: string }> | undefined
  
  if (mode === 'ragflow') {
    // RAGFlow 模式：使用 Workspace 的 chatId 检索知识库
    if (!message.workspace?.ragflowChatId) {
      return Response.json({ error: "Workspace RAGFlow not configured" }, { status: 400 })
    }
    
    const result = await callRAGFlowWithChatId(
      session.user.id,
      message.workspace.ragflowChatId,
      [{ role: 'user', content }]
    )
    aiResponse = result.content
    references = result.references
  } else {
    // OpenAI 模式：直接使用 OpenAI，上下文仅为当前帖子
    const systemPrompt = await buildSystemPrompt(session.user.id)
    aiResponse = await callOpenAI({
      userId: session.user.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `原文：${message.content}\n\n用户问题：${content}` },
      ],
    })
  }
  
  // 保存 AI 回复...
}
```

### 前端实现

#### 文件: `src/components/InputMachine.tsx` 或评论输入组件

检测内容中的 @mention 来决定调用模式：

```typescript
const detectAIMode = (content: string): 'goldierill' | 'ragflow' | null => {
  if (/@ragflow/i.test(content)) return 'ragflow'
  if (/@goldierill/i.test(content)) return 'goldierill'
  return null
}

const handleSubmit = async () => {
  const aiMode = detectAIMode(content)
  
  if (aiMode) {
    // 调用 AI Chat API
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messageId,
        content,
        mode: aiMode,
      }),
    })
  } else {
    // 普通消息发送
    // ...
  }
}
```

### AiConfig 修改

移除 `enableRag` 字段，因为现在通过 @mention 区分模式：

```prisma
model AiConfig {
  // 保留的全局配置
  openaiBaseUrl        String    @default("http://localhost:4000")
  openaiApiKey         String    @default("")
  openaiModel          String    @default("gpt-3.5-turbo")
  ragflowBaseUrl       String    @default("http://localhost:4154")
  ragflowApiKey        String    @default("")
  autoTagModel         String    @default("gpt-3.5-turbo")
  briefingModel        String    @default("gpt-3.5-turbo")
  briefingTime         String    @default("08:00")
  aiPersonality        String    @default("friendly")
  aiExpertise          String?
  asrApiKey            String    @default("")
  asrApiUrl            String    @default("...")
  
  // 移除字段:
  // - enableRag (改用 @mention 区分)
  // - ragflowChatId (迁移到 Workspace)
  // - ragflowDatasetId (迁移到 Workspace)
  // - enableAutoTag (迁移到 Workspace)
  // - enableBriefing (迁移到 Workspace)
  // - enableLinkSuggestion (可保留或移除)
}
```

---

## 3. 数据库模型修改

### 3.1 新增 Workspace 模型

在 `prisma/schema.prisma` 中添加：

```prisma
model Workspace {
  id              String    @id @default(cuid())
  name            String    // "日常消息", "编程技术"
  description     String?
  isDefault       Boolean   @default(false)  // 默认工作区
  
  // RAGFlow 配置 - 每个 Workspace 独立
  ragflowDatasetId  String?
  ragflowChatId     String?
  
  // AI 功能配置（从 AiConfig 迁移）
  enableAutoTag     Boolean   @default(true)
  enableBriefing    Boolean   @default(true)
  
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages        Message[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
  @@unique([userId, name])  // 同一用户下工作区名称唯一
}
```

### 3.2 修改 Message 模型

添加 `workspaceId` 字段：

```prisma
model Message {
  // ... 现有字段 ...
  workspaceId     String?
  workspace       Workspace? @relation(fields: [workspaceId], references: [id])
  
  @@index([workspaceId])
}
```

### 3.3 修改 User 模型

添加 workspaces 关系：

```prisma
model User {
  // ... 现有字段 ...
  workspaces    Workspace[]
}
```

### 3.4 运行迁移

```bash
pnpm prisma migrate reset --force
pnpm prisma generate
pnpm prisma db push
```

---

## 4. RAGFlow 自动配置

### 4.1 RAGFlow 配置参数

创建 Workspace 时，需要自动申请 RAGFlow 资源。以下是固定配置参数：

| 参数 | 说明 | 值 |
|------|------|-----|
| **Dataset 名称** | 知识库名称 | `${userId}_${workspaceName}` (确保唯一) |
| **Chat 名称** | 聊天助手名称 | `GoldieRill_${workspaceName}` |
| **嵌入模型** | embedding_model | `Qwen/Qwen3-Embedding-8B@SILICONFLOW` |
| **分块方法** | chunk_method | `one` |
| **初始向量化文本** | 用于初始化 Dataset | `这是一条预设的向量化文本内容，用于初始化知识库。` |
| **系统提示词** | prompt | 见下方 |
| **开场白** | opener | `null` (关闭) |
| **空回复** | empty_response | `null` (关闭) |

#### 系统提示词

```
你是一个运行在 WhiteNote 的智能助手你叫 Goldie Rill，请总结 WhiteNote 帖子的内容来回答问题，请列举 WhiteNote 帖子中的数据详细回答。当所有WhiteNote 帖子内容都与问题无关时，你的回答必须包括"WhiteNote 中未找到您要的答案！"这句话。回答需要考虑聊天历史。以下是 WhiteNote 帖子：{knowledge}以上是 WhiteNote 帖子。
```

#### LLM 参数（无法通过 API 关闭）

以下参数无法通过 API 设置为 `null`，需要在 RAGFlow UI 中手动关闭：

- `temperature` - 温度 (0-2)
- `top_p` - 采样参数 (0-1)
- `presence_penalty` - 存在惩罚 (0-2)
- `frequency_penalty` - 频率惩罚 (0-2)
- `max_tokens` - 最大 tokens

### 4.2 完整实现代码

#### 文件: `src/lib/ragflow/provision.ts`

```typescript
const EMBEDDING_MODEL = 'Qwen/Qwen3-Embedding-8B@SILICONFLOW'
const CHUNK_METHOD = 'one'
const INIT_CONTENT = '这是一条预设的向量化文本内容，用于初始化知识库。'
const SYSTEM_PROMPT = `你是一个运行在 WhiteNote 的智能助手你叫 Goldie Rill，请总结 WhiteNote 帖子的内容来回答问题，请列举 WhiteNote 帖子中的数据详细回答。当所有WhiteNote 帖子内容都与问题无关时，你的回答必须包括"WhiteNote 中未找到您要的答案！"这句话。回答需要考虑聊天历史。以下是 WhiteNote 帖子：{knowledge}以上是 WhiteNote 帖子。`

interface ProvisionResult {
  datasetId: string
  chatId: string
}

export async function provisionRAGFlowForWorkspace(
  ragflowBaseUrl: string,
  ragflowApiKey: string,
  workspaceName: string,
  userId: string
): Promise<ProvisionResult> {
  const datasetName = `${userId}_${workspaceName}`
  const chatName = `GoldieRill_${workspaceName}`

  // 1. 创建 Dataset（知识库）
  const datasetResponse = await fetch(`${ragflowBaseUrl}/api/v1/datasets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ragflowApiKey}`
    },
    body: JSON.stringify({
      name: datasetName,
      embedding_model: EMBEDDING_MODEL,
      chunk_method: CHUNK_METHOD
    })
  })
  
  const datasetResult = await datasetResponse.json()
  if (datasetResult.code !== 0 || !datasetResult.data) {
    throw new Error(`创建知识库失败: ${datasetResult.message}`)
  }
  const datasetId = datasetResult.data.id

  // 2. 上传初始文档（RAGFlow 要求 Dataset 必须有文档才能绑定 Chat）
  const formData = new FormData()
  const blob = new Blob([INIT_CONTENT], { type: 'text/plain' })
  formData.append('file', blob, 'init.txt')
  
  const docResponse = await fetch(
    `${ragflowBaseUrl}/api/v1/datasets/${datasetId}/documents`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ragflowApiKey}` },
      body: formData
    }
  )
  
  const docResult = await docResponse.json()
  if (docResult.code !== 0 || !docResult.data?.[0]) {
    throw new Error(`创建文档失败: ${docResult.message}`)
  }
  const documentId = docResult.data[0].id

  // 3. 添加 Chunk（向量化）
  await fetch(
    `${ragflowBaseUrl}/api/v1/datasets/${datasetId}/documents/${documentId}/chunks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ragflowApiKey}`
      },
      body: JSON.stringify({ content: INIT_CONTENT })
    }
  )

  // 4. 创建 Chat（绑定知识库）
  const chatResponse = await fetch(`${ragflowBaseUrl}/api/v1/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ragflowApiKey}`
    },
    body: JSON.stringify({
      name: chatName,
      dataset_ids: [datasetId],
      prompt: {
        prompt: SYSTEM_PROMPT
      }
    })
  })
  
  const chatResult = await chatResponse.json()
  if (chatResult.code !== 0 || !chatResult.data) {
    throw new Error(`创建聊天失败: ${chatResult.message}`)
  }
  const chatId = chatResult.data.id

  // 5. 更新 Chat 配置（关闭开场白和空回复）
  await fetch(`${ragflowBaseUrl}/api/v1/chats/${chatId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ragflowApiKey}`
    },
    body: JSON.stringify({
      dataset_ids: [datasetId],
      prompt: {
        prompt: SYSTEM_PROMPT,
        empty_response: null,  // 关闭空回复
        opener: null           // 关闭开场白
      }
    })
  })

  // 注意：LLM 参数 (temperature, top_p 等) 无法通过 API 关闭
  // 需要在 RAGFlow UI (http://localhost:4154) 中手动设置

  return { datasetId, chatId }
}
```

### 4.3 API 端点

#### 文件: `src/app/api/workspaces/route.ts`

```typescript
import { provisionRAGFlowForWorkspace } from '@/lib/ragflow/provision'

// POST /api/workspaces - 创建新 Workspace
export async function POST(request: NextRequest) {
  const session = await requireAuth()
  const { name, description } = await request.json()
  
  // 获取用户的 RAGFlow 配置
  const config = await getAiConfig(session.user.id)
  
  if (!config.ragflowBaseUrl || !config.ragflowApiKey) {
    return Response.json(
      { error: "请先在 AI 配置中设置 RAGFlow Base URL 和 API Key" },
      { status: 400 }
    )
  }
  
  // 自动创建 RAGFlow 资源
  const { datasetId, chatId } = await provisionRAGFlowForWorkspace(
    config.ragflowBaseUrl,
    config.ragflowApiKey,
    name,
    session.user.id
  )
  
  // 创建 Workspace 记录
  const workspace = await prisma.workspace.create({
    data: {
      name,
      description,
      userId: session.user.id,
      ragflowDatasetId: datasetId,
      ragflowChatId: chatId,
    }
  })
  
  return Response.json({ data: workspace })
}
```

### 4.4 删除 Workspace 时清理 RAGFlow 资源

```typescript
// DELETE /api/workspaces/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth()
  
  const workspace = await prisma.workspace.findUnique({
    where: { id: params.id, userId: session.user.id }
  })
  
  if (!workspace) {
    return Response.json({ error: "Workspace not found" }, { status: 404 })
  }
  
  const config = await getAiConfig(session.user.id)
  
  // 1. 删除 RAGFlow Dataset
  if (workspace.ragflowDatasetId) {
    await fetch(`${config.ragflowBaseUrl}/api/v1/datasets`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ragflowApiKey}`
      },
      body: JSON.stringify({ ids: [workspace.ragflowDatasetId] })
    })
  }
  
  // 2. 删除 RAGFlow Chat
  if (workspace.ragflowChatId) {
    await fetch(`${config.ragflowBaseUrl}/api/v1/chats/${workspace.ragflowChatId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${config.ragflowApiKey}` }
    })
  }
  
  // 3. 删除数据库中的 Workspace（级联删除 Messages）
  await prisma.workspace.delete({ where: { id: params.id } })
  
  return Response.json({ success: true })
}
```

---

## 5. 后端 API 修改

### 5.1 修改消息相关 API

#### 文件: `src/app/api/messages/route.ts`

**GET /api/messages**
```typescript
// 添加 workspaceId 查询参数
const { searchParams } = new URL(request.url)
const workspaceId = searchParams.get('workspaceId')

const messages = await prisma.message.findMany({
  where: {
    authorId: session.user.id,
    workspaceId: workspaceId || undefined, // 如果为空则返回所有
  },
  // ...
})
```

**POST /api/messages**
```typescript
// 从 body 获取 workspaceId
const { content, workspaceId, ... } = body

const message = await prisma.message.create({
  data: {
    content,
    authorId: session.user.id,
    workspaceId, // 新增
    // ...
  },
})
```

### 5.2 修改 RAGFlow 调用函数

#### 文件: `src/lib/ai/ragflow.ts`

新增接收 chatId 参数的版本：

```typescript
export async function callRAGFlowWithChatId(
  userId: string,
  chatId: string,
  messages: RAGFlowMessage[]
) {
  const config = await getAiConfig(userId) // 获取全局配置
  
  const response = await fetch(
    `${config.ragflowBaseUrl}/api/v1/chats_openai/${chatId}/chat/completions`,
    // ...
  )
}
```

同样修改 `syncToRAGFlow`, `deleteFromRAGFlow`, `updateRAGFlow`，增加 `datasetId` 参数。

---

## 6. 队列处理器修改

### 6.1 修改 sync-ragflow 处理器

#### 文件: `src/lib/queue/processors/sync-ragflow.ts`

```typescript
interface SyncRAGFlowJobData {
  userId: string
  messageId: string
  workspaceId: string  // 新增
  contentType?: 'message' | 'comment'
}

export async function processSyncRAGFlow(job: Job<SyncRAGFlowJobData>) {
  const { userId, messageId, workspaceId, contentType = 'message' } = job.data

  // 获取 Workspace 的 datasetId
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ragflowDatasetId: true }
  })
  
  if (!workspace?.ragflowDatasetId) return
  
  // 使用 Workspace 的 datasetId 同步
  await syncToRAGFlowWithDatasetId(userId, workspace.ragflowDatasetId, messageId, content)
}
```

### 6.2 每日晨报处理器（保持不变）

#### 文件: `src/lib/queue/processors/daily-briefing.ts`

晨报继续使用 **OpenAI API + 数据库直接查询**，不使用 RAGFlow：

```typescript
export async function processDailyBriefing(job: Job) {
  // 获取所有启用晨报的 Workspace
  const workspacesWithBriefing = await prisma.workspace.findMany({
    where: { enableBriefing: true },
    include: { user: { include: { aiConfig: true } } }
  })

  for (const workspace of workspacesWithBriefing) {
    const config = workspace.user.aiConfig
    if (!config) continue
    
    // 获取该 Workspace 昨天的消息（直接从数据库查询）
    const messages = await prisma.message.findMany({
      where: {
        workspaceId: workspace.id,
        createdAt: { gte: yesterday, lt: today },
      },
      select: { content: true },
    })
    
    if (messages.length === 0) continue
    
    // 使用 OpenAI API 生成晨报（不使用 RAGFlow）
    const contentSummary = messages.map(m => m.content).join("\n---\n")
    const briefingContent = await callOpenAI({
      userId: workspace.userId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: briefingPrompt + contentSummary },
      ],
      model: config.briefingModel,
    })
    
    // 创建晨报消息到该 Workspace
    await prisma.message.create({
      data: {
        content: `# ☀️ 每日晨报 - ${workspace.name} - ${dateStr}\n\n${briefingContent}`,
        workspaceId: workspace.id,  // 关联到对应 Workspace
        authorId: null,  // 系统生成
        isPinned: true,
      },
    })
  }
}
```

**重点**：晨报生成流程：
1. 直接从数据库查询 Workspace 昨天的消息
2. 使用 `callOpenAI()` + `briefingModel` 生成摘要
3. 不涉及 RAGFlow

---

## 7. 前端 UI 修改

### 7.1 首页 Workspace 切换器

#### 文件: `src/app/page.tsx`

替换现有的 "For you" / "Following" 按钮：

```tsx
// 添加状态管理
const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
const [workspaces, setWorkspaces] = useState<Workspace[]>([])
const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)

// UI 结构
<div className="desktop:block hidden sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
  <div className="flex w-full relative">
    {/* Workspace 下拉菜单触发器 */}
    <button 
      className="flex-1 py-4 hover:bg-secondary/50 transition-colors relative flex justify-center items-center gap-2"
      onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
    >
      <span className="font-bold text-sm">
        {currentWorkspace?.name || '选择工作区'}
      </span>
      <ChevronDown className="h-4 w-4" />
      <div className="absolute bottom-0 h-1 w-14 bg-primary rounded-full" />
    </button>
    
    {/* 下拉菜单 */}
    {showWorkspaceMenu && (
      <div className="absolute top-full left-0 w-full bg-background border border-border rounded-b-lg shadow-lg z-50">
        {workspaces.map(ws => (
          <button
            key={ws.id}
            className="w-full px-4 py-3 text-left hover:bg-secondary/50"
            onClick={() => {
              setCurrentWorkspaceId(ws.id)
              setShowWorkspaceMenu(false)
            }}
          >
            {ws.name}
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

### 7.2 全局状态管理

#### 文件: `src/store/useWorkspaceStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkspaceStore {
  currentWorkspaceId: string | null
  setCurrentWorkspaceId: (id: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
    }),
    { name: 'workspace-storage' }
  )
)
```

### 7.3 设置页面 - Workspace 管理

#### 文件: `src/app/settings/page.tsx`

在 `navItems` 中添加：

```typescript
import { Layers } from "lucide-react"

const navItems = [
  // ... 现有项目
  { id: 'workspaces', label: '工作区管理', icon: Layers },
]
```

#### 新建: `src/components/WorkspaceManager.tsx`

```tsx
export function WorkspaceManager() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  
  return (
    <div className="space-y-6">
      {/* 新建 Workspace */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">新建工作区</h3>
        <div className="flex gap-2">
          <Input 
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="工作区名称，如：编程技术"
          />
          <Button onClick={handleCreate}>
            创建
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          创建后将自动配置 RAGFlow 知识库
        </p>
      </Card>
      
      {/* Workspace 列表 */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">我的工作区</h3>
        <div className="space-y-3">
          {workspaces.map(ws => (
            <div key={ws.id} className="flex items-center justify-between p-3 rounded-lg border">
              {editingId === ws.id ? (
                <Input 
                  value={ws.name}
                  onChange={e => handleRename(ws.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                />
              ) : (
                <span className="font-medium">{ws.name}</span>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingId(ws.id)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(ws.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                {ws.isDefault && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">默认</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
```

### 7.4 修改 AIConfigForm 组件

#### 文件: `src/components/AIConfigForm.tsx`

移除以下配置项（因为已迁移到 Workspace 或改用 @mention）：

- ❌ `enableRag` 开关（改用 `@goldierill` vs `@ragflow`）
- ❌ `ragflowChatId` 输入框（迁移到 Workspace）
- ❌ `ragflowDatasetId` 输入框（迁移到 Workspace）

保留：
- ✅ `ragflowBaseUrl` - RAGFlow 服务地址（全局）
- ✅ `ragflowApiKey` - RAGFlow API Key（全局）
- ✅ OpenAI 相关配置
- ✅ ASR 相关配置
- ✅ AI 功能配置（人设等）

### 7.5 修改 Tags 页面

#### 文件: `src/app/tags/page.tsx` 和 `src/actions/graph.ts`

图谱数据需要支持按 Workspace 筛选：

```typescript
// src/actions/graph.ts
export async function getGraphData(workspaceId?: string): Promise<GraphData> {
  const messages = await prisma.message.findMany({
    where: workspaceId ? { workspaceId } : {},
    // ...
  })
}
```

---

## 8. 跨 Workspace 搜索

### 8.1 全局搜索模式

当用户需要跨 Workspace 搜索时（使用 `@ragflow`），需要聚合多个 RAGFlow Chat 的结果：

```typescript
export async function globalRAGFlowSearch(userId: string, query: string) {
  // 1. 获取用户所有 Workspace
  const workspaces = await prisma.workspace.findMany({
    where: { userId },
    select: { id: true, name: true, ragflowChatId: true }
  })
  
  // 2. 并行查询所有 RAGFlow Chat
  const results = await Promise.all(
    workspaces.map(ws => 
      callRAGFlowWithChatId(userId, ws.ragflowChatId!, [{ role: 'user', content: query }])
        .then(r => ({ workspaceId: ws.id, workspaceName: ws.name, ...r }))
        .catch(() => null)
    )
  )
  
  // 3. 合并结果，按相关性排序
  return results.filter(Boolean).sort((a, b) => /* 按相关性排序 */)
}
```

### 8.2 UI 切换

在 `@ragflow` 模式下，可添加 "全部工作区搜索" 选项。

---

## 9. 数据迁移与清理

由于用户确认可以清空数据库，无需迁移逻辑。运行以下命令：

```bash
pnpm prisma migrate reset --force
pnpm prisma generate
pnpm prisma db push
```

如果需要更新 seed 数据，修改 `prisma/seed.ts`：

```typescript
// 创建默认 Workspace
const defaultWorkspace = await prisma.workspace.create({
  data: {
    name: '默认',
    isDefault: true,
    userId: user.id,
    // ragflowDatasetId 和 ragflowChatId 在首次配置 RAGFlow 后自动创建
  }
})
```

---

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `prisma/schema.prisma` | 修改 | 新增 Workspace 模型，修改 Message、AiConfig、User |
| `src/lib/ragflow/provision.ts` | 新建 | RAGFlow 资源自动配置 |
| `src/app/api/workspaces/route.ts` | 新建 | Workspace CRUD API |
| `src/app/api/workspaces/[id]/route.ts` | 新建 | 单个 Workspace 操作 |
| `src/app/api/messages/route.ts` | 修改 | 支持 workspaceId 过滤 |
| `src/app/api/ai/chat/route.ts` | 修改 | 支持 `mode` 参数区分 `@goldierill` / `@ragflow` |
| `src/lib/ai/ragflow.ts` | 修改 | 新增 `callRAGFlowWithChatId`，支持传入 datasetId/chatId |
| `src/lib/ai/config.ts` | 修改 | 移除 enableRag 和 Workspace 级别字段 |
| `src/lib/queue/processors/sync-ragflow.ts` | 修改 | 支持 workspaceId |
| `src/lib/queue/processors/daily-briefing.ts` | 修改 | 按 Workspace 生成晨报（仍用 OpenAI） |
| `src/store/useWorkspaceStore.ts` | 新建 | Workspace 状态管理 |
| `src/app/page.tsx` | 修改 | Workspace 切换器 UI |
| `src/app/settings/page.tsx` | 修改 | 添加 Workspace 管理入口 |
| `src/components/WorkspaceManager.tsx` | 新建 | Workspace 管理组件 |
| `src/components/InputMachine.tsx` | 修改 | 发送时携带 workspaceId，检测 @mention 模式 |
| `src/components/MessagesList.tsx` | 修改 | 按 workspaceId 过滤 |
| `src/components/AIConfigForm.tsx` | 修改 | 移除 enableRag、Dataset/Chat ID 配置 |
| `src/actions/graph.ts` | 修改 | 支持按 Workspace 过滤图谱 |
| `src/app/tags/page.tsx` | 修改 | 传递当前 workspaceId 到 getGraphData |
| `src/types/api.ts` | 修改 | 更新类型定义 |

---

## 验证计划

### 手动测试步骤

1. **Workspace 创建**
   - 访问 `/settings/workspaces`
   - 创建名为 "编程技术" 的 Workspace
   - 验证 RAGFlow 控制台 (`http://localhost:4154`) 出现新的 Dataset 和 Chat

2. **消息隔离**
   - 在 "编程技术" Workspace 发送消息
   - 切换到其他 Workspace，验证看不到刚发送的消息
   - 切换回 "编程技术"，验证消息存在

3. **@goldierill 模式**
   - 在帖子中 `@goldierill` 提问
   - 验证使用 OpenAI 直接回答，上下文仅为当前帖子

4. **@ragflow 模式**
   - 在 "编程技术" Workspace `@ragflow` 提问
   - 验证使用 RAGFlow 检索，只返回该 Workspace 的相关内容

5. **Tags 页面**
   - 访问 `/tags`
   - 验证图谱只显示当前 Workspace 的消息

6. **每日晨报**
   - 触发晨报生成任务
   - 验证每个 Workspace 生成独立的晨报（使用 OpenAI）

---

## 参考文档

- [HttpAPIRAGFlow/README.md](file:///d:/Code/WhiteNote/HttpAPIRAGFlow/README.md) - RAGFlow API 参考
- [HttpAPIRAGFlow/createRAGFlow.js](file:///d:/Code/WhiteNote/HttpAPIRAGFlow/createRAGFlow.js) - 创建知识库示例
- [PRODUCT_DESIGN_V2.5.md](file:///d:/Code/WhiteNote/docs/PRODUCT_DESIGN_V2.5.md) - 产品设计文档
