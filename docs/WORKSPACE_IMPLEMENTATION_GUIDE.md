# 多 Workspace 功能实现指南

本文档记录了 WhiteNote 多 Workspace（工作区）功能的完整实现，让用户可以创建多个独立的数据库空间（如"日常消息"、"编程技术"），每个 Workspace 拥有独立的 RAGFlow 知识库和晨报功能。

---

## 目录

1. [架构概述](#1-架构概述)
2. [数据库模型修改](#2-数据库模型修改)
3. [RAGFlow 自动配置](#3-ragflow-自动配置)
4. [后端 API 修改](#4-后端-api-修改)
5. [队列处理器修改](#5-队列处理器修改)
6. [前端 UI 修改](#6-前端-ui-修改)
7. [使用指南](#7-使用指南)
8. [故障排查](#8-故障排查)

---

## 1. 架构概述

### 当前架构（多 Workspace + 独立知识库）

```
User → Workspaces[] →  每个 Workspace 拥有:
                       ├── ragflowDatasetId (独立知识库)
                       ├── ragflowChatId (独立 AI 助手)
                       ├── enableAutoTag (自动打标签)
                       ├── enableBriefing (每日晨报)
                       └── Messages[] (消息隔离)

AiConfig 保留全局配置:
  ├── openaiBaseUrl / openaiApiKey / openaiModel
  ├── ragflowBaseUrl / ragflowApiKey
  ├── autoTagModel / briefingModel
  └── aiPersonality / aiExpertise
```

### 关键技术栈
- **数据库**: Prisma 7 + PostgreSQL
- **RAGFlow API**: `POST /api/v1/datasets`, `POST /api/v1/chats`
- **队列**: BullMQ + Redis
- **前端状态**: Zustand + persist 中间件
- **框架**: Next.js 16 + App Router

---

## 2. 数据库模型修改

### 2.1 新增 Workspace 模型

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

### 2.2 修改 Message 模型

添加 `workspaceId` 字段：

```prisma
model Message {
  // ... 现有字段 ...
  workspaceId     String?
  workspace       Workspace? @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId])
}
```

### 2.3 修改 User 模型

添加 workspaces 关系：

```prisma
model User {
  // ... 现有字段 ...
  workspaces    Workspace[]
}
```

### 2.4 修改 AiConfig 模型

移除以下字段（迁移到 Workspace）：
- ❌ `ragflowChatId`
- ❌ `ragflowDatasetId`
- ❌ `enableAutoTag`
- ❌ `enableBriefing`
- ❌ `enableRag`（改用 @mention 区分）

保留全局配置：
- ✅ `openaiBaseUrl / openaiApiKey / openaiModel`
- ✅ `ragflowBaseUrl / ragflowApiKey`
- ✅ `autoTagModel / briefingModel`
- ✅ `aiPersonality / aiExpertise`

---

## 3. RAGFlow 自动配置

### 3.1 RAGFlow 配置参数

创建 Workspace 时，自动申请 RAGFlow 资源。以下是固定配置参数：

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

### 3.2 实现文件

**文件: `src/lib/ragflow/provision.ts`**

```typescript
export async function provisionRAGFlowForWorkspace(
  ragflowBaseUrl: string,
  ragflowApiKey: string,
  workspaceName: string,
  userId: string
): Promise<ProvisionResult> {
  // 1. 创建 Dataset（知识库）
  // 2. 上传初始文档
  // 3. 添加 Chunk（向量化）
  // 4. 创建 Chat（绑定知识库）
  // 5. 更新 Chat 配置（关闭开场白和空回复）

  return { datasetId, chatId }
}
```

### 3.3 API 端点

#### 创建 Workspace（自动配置 RAGFlow）

**文件: `src/app/api/workspaces/route.ts`**

```typescript
// POST /api/workspaces - 创建新 Workspace
export async function POST(request: NextRequest) {
  const session = await auth()
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

#### 为现有 Workspace 初始化 RAGFlow

**文件: `src/app/api/workspaces/[id]/initialize-ragflow/route.ts`**

```typescript
// POST /api/workspaces/[id]/initialize-ragflow
// 用于为默认工作区或其他没有 RAGFlow 资源的工作区初始化
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  // 验证 Workspace 所有权
  const workspace = await prisma.workspace.findUnique({
    where: { id }
  })

  if (!workspace || workspace.userId !== session.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 检查是否已初始化
  if (workspace.ragflowDatasetId && workspace.ragflowChatId) {
    return Response.json({
      error: "Workspace already has RAGFlow resources"
    }, { status: 400 })
  }

  // 获取 RAGFlow 配置
  const config = await getAiConfig(session.user.id)

  // 调用 provision 函数
  const { datasetId, chatId } = await provisionRAGFlowForWorkspace(
    config.ragflowBaseUrl,
    config.ragflowApiKey,
    workspace.name,
    session.user.id
  )

  // 更新 Workspace 记录
  const updatedWorkspace = await prisma.workspace.update({
    where: { id },
    data: {
      ragflowDatasetId: datasetId,
      ragflowChatId: chatId
    }
  })

  return Response.json({ success: true, data: updatedWorkspace })
}
```

---

## 4. 后端 API 修改

### 4.1 消息相关 API

**文件: `src/app/api/messages/route.ts`**

```typescript
// GET /api/messages?workspaceId=xxx
const workspaceId = searchParams.get('workspaceId')

const messages = await prisma.message.findMany({
  where: {
    authorId: session.user.id,
    workspaceId: workspaceId || undefined,
  },
})

// POST /api/messages
const { content, workspaceId, ... } = body

const message = await prisma.message.create({
  data: {
    content,
    authorId: session.user.id,
    workspaceId,
  },
})
```

**文件: `src/app/api/messages/[id]/route.ts`**

更新消息时同步到 RAGFlow（需要传入 datasetId）：

```typescript
if (contentChanged || tagsChanged) {
  const contentWithTags = await buildContentWithTags(id)
  if (message.workspace?.ragflowDatasetId) {
    updateRAGFlow(
      session.user.id,
      message.workspace.ragflowDatasetId,
      id,
      contentWithTags
    ).catch(console.error)
  }
}
```

### 4.2 RAGFlow 调用函数

**文件: `src/lib/ai/ragflow.ts`**

所有函数新增 `datasetId` 参数：

```typescript
export async function syncToRAGFlow(
  userId: string,
  datasetId: string,
  messageId: string,
  content: string,
  medias?: Media[]
)

export async function deleteFromRAGFlow(
  userId: string,
  datasetId: string,
  id: string,
  contentType: 'message' | 'comment' = 'message'
)

export async function updateRAGFlow(
  userId: string,
  datasetId: string,
  messageId: string,
  content: string
)
```

---

## 5. 队列处理器修改

### 5.1 sync-ragflow 处理器

**文件: `src/lib/queue/processors/sync-ragflow.ts`**

```typescript
interface SyncRAGFlowJobData {
  userId: string
  workspaceId: string  // 新增
  messageId: string
  contentType?: 'message' | 'comment'
}

export async function processSyncRAGFlow(job: Job<SyncRAGFlowJobData>) {
  const { userId, workspaceId, messageId, contentType = 'message' } = job.data

  // 获取 Workspace 的 datasetId
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ragflowDatasetId: true }
  })

  if (!workspace?.ragflowDatasetId) {
    console.log(`[SyncRAGFlow] Workspace ${workspaceId} has no RAGFlow dataset, skipping sync`)
    return
  }

  // 使用 Workspace 的 datasetId 同步
  await syncToRAGFlowWithDatasetId(userId, workspace.ragflowDatasetId, messageId, content)
}
```

### 5.2 auto-tag 处理器

**文件: `src/lib/queue/processors/auto-tag.ts`**

```typescript
interface AutoTagJobData {
  userId: string
  workspaceId: string  // 新增
  messageId: string
}

export async function processAutoTag(job: Job<AutoTagJobData>) {
  const { userId, workspaceId, messageId } = job.data

  // 检查 Workspace 的 enableAutoTag
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { enableAutoTag: true }
  })

  if (!workspace?.enableAutoTag) {
    console.log(`[AutoTag] Auto-tagging disabled for workspace: ${workspaceId}`)
    // 直接跳到同步步骤
    await addTask("sync-ragflow", { userId, workspaceId, messageId })
    return
  }

  // 执行自动打标签...
  await applyAutoTags(userId, messageId, config?.autoTagModel)

  // 触发 RAGFlow 同步
  await addTask("sync-ragflow", { userId, workspaceId, messageId })
}
```

### 5.3 auto-tag-extended 处理器（支持 Comments）

**文件: `src/lib/queue/processors/auto-tag-extended.ts`**

处理消息和评论的自动打标签：

```typescript
interface AutoTagJobData {
  userId: string
  workspaceId: string  // 新增
  messageId?: string
  commentId?: string
  contentType: 'message' | 'comment'
}

export async function processAutoTagExtended(job: Job<AutoTagJobData>) {
  const { userId, workspaceId, messageId, commentId, contentType } = job.data

  // 检查 Workspace 的 enableAutoTag
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { enableAutoTag: true }
  })

  if (!workspace?.enableAutoTag) {
    // 跳过自动打标签，直接同步
    await addTask("sync-ragflow", {
      userId,
      workspaceId,
      messageId: contentId,
      contentType
    })
    return
  }

  // 执行自动打标签...
  await applyAutoTags(userId, contentId, config?.autoTagModel, contentType)

  // 触发 RAGFlow 同步
  await addTask("sync-ragflow", {
    userId,
    workspaceId,
    messageId: contentId,
    contentType
  })
}
```

### 5.4 Comments API

**文件: `src/app/api/messages/[id]/comments/route.ts`**

创建评论时添加到队列：

```typescript
const messageWithWorkspace = await prisma.message.findUnique({
  where: { id },
  select: {
    workspace: {
      select: { enableAutoTag: true, ragflowDatasetId: true },
    },
  },
})

if (messageWithWorkspace?.workspace?.enableAutoTag) {
  await addTask("auto-tag-comment", {
    userId: session.user.id,
    workspaceId: message.workspaceId,
    commentId: comment.id,
    contentType: 'comment',
  })
} else if (messageWithWorkspace?.workspace?.ragflowDatasetId) {
  // 如果没有启用自动打标签但配置了 RAGFlow，直接同步
  await addTask("sync-ragflow", {
    userId: session.user.id,
    workspaceId: message.workspaceId,
    messageId: comment.id,
    contentType: 'comment',
  })
}
```

---

## 6. 前端 UI 修改

### 6.1 全局状态管理

**文件: `src/store/useWorkspaceStore.ts`**

使用 Zustand + persist 中间件：

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

### 6.2 首页 Workspace 切换器

**文件: `src/app/page.tsx`**

桌面端顶部 Workspace 下拉菜单：

```tsx
const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore()
const [workspaces, setWorkspaces] = useState<Workspace[]>([])
const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)

// 加载用户的 Workspace 列表
useEffect(() => {
  const fetchWorkspaces = async () => {
    if (session?.user) {
      const result = await workspacesApi.getWorkspaces()
      if (result.data) {
        setWorkspaces(result.data)
        // 如果没有选中的 Workspace 且有默认 Workspace，自动选中
        if (!currentWorkspaceId && result.data.length > 0) {
          const defaultWorkspace = result.data.find((w) => w.isDefault) || result.data[0]
          setCurrentWorkspaceId(defaultWorkspace.id)
        }
      }
    }
  }
  fetchWorkspaces()
}, [session, currentWorkspaceId, setCurrentWorkspaceId])

// UI
<div className="desktop:block hidden sticky top-0 z-10 bg-background/80 backdrop-blur-md">
  <button onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}>
    {currentWorkspace?.name || '选择工作区'}
    <ChevronDown className="h-4 w-4" />
  </button>

  {showWorkspaceMenu && (
    <div>
      {workspaces.map(ws => (
        <button onClick={() => {
          setCurrentWorkspaceId(ws.id)
          setShowWorkspaceMenu(false)
          setRefreshKey(prev => prev + 1)
        }}>
          {ws.name}
        </button>
      ))}
    </div>
  )}
</div>
```

### 6.3 设置页面 - Workspace 管理

**文件: `src/app/settings/workspaces/page.tsx`**

```tsx
import { WorkspaceManager } from "@/components/WorkspaceManager"

export default function WorkspacesSettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold">工作区管理</h1>
        <p className="text-muted-foreground mt-2">
          创建和管理您的工作区，每个工作区有独立的知识库和设置
        </p>
        <WorkspaceManager />
      </div>
    </div>
  )
}
```

**文件: `src/components/WorkspaceManager.tsx`**

功能包括：
- 创建新 Workspace（自动配置 RAGFlow）
- 编辑 Workspace（名称、描述、enableAutoTag、enableBriefing）
- 删除 Workspace（同时删除 RAGFlow 资源）
- 初始化 RAGFlow（为默认工作区或其他没有 RAGFlow 的 Workspace）
- 显示 RAGFlow 配置状态

关键功能：初始化 RAGFlow 按钮

```tsx
// 只在未配置 RAGFlow 时显示
{!ws.ragflowDatasetId && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleInitializeRAG(ws.id)}
    disabled={isInitializingRAG === ws.id}
    title="初始化 RAGFlow 知识库"
    className="text-blue-600 hover:text-blue-700"
  >
    {isInitializingRAG === ws.id ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <Database className="h-4 w-4" />
    )}
  </Button>
)}
```

### 6.4 MessagesList 组件

**文件: `src/components/MessagesList.tsx`**

```typescript
const { currentWorkspaceId } = useWorkspaceStore()

useEffect(() => {
  fetchMessages()
}, [filters, currentWorkspaceId]) // 监听 currentWorkspaceId 变化
```

### 6.5 InputMachine 组件

**文件: `src/components/InputMachine.tsx`**

发送消息时携带 workspaceId：

```typescript
const { currentWorkspaceId } = useWorkspaceStore()

const response = await messagesApi.createMessage({
  content: finalContent,
  workspaceId: currentWorkspaceId,
  // ...
})
```

### 6.6 Tags 页面

**文件: `src/actions/graph.ts`**

```typescript
'use server'

export async function getGraphData(workspaceId?: string): Promise<GraphData> {
  const messages = await prisma.message.findMany({
    where: workspaceId ? { workspaceId } : {},
    // ...
  })
}
```

**文件: `src/app/tags/page.tsx`**

```tsx
const { currentWorkspaceId } = useWorkspaceStore()

useEffect(() => {
  const fetchData = async () => {
    const data = await getGraphData(currentWorkspaceId || undefined)
    setData(data)
  }
  fetchData()
}, [currentWorkspaceId])
```

---

## 7. 使用指南

### 7.1 首次使用配置

1. **配置 RAGFlow API**
   - 访问 `/settings/ai`
   - 设置 RAGFlow Base URL: `http://localhost:4154`
   - 设置 RAGFlow API Key

2. **为默认工作区初始化 RAGFlow**
   - 访问 `/settings/workspaces`
   - 找到"默认"工作区
   - 点击 🗄️ 数据库图标（蓝色）
   - 等待初始化完成
   - 验证状态变为 `RAGFlow: ✓`（绿色）

### 7.2 创建新工作区

1. **创建工作区**
   - 访问 `/settings/workspaces`
   - 输入工作区名称（如"编程技术"）
   - 点击"创建工作区"
   - 系统自动配置 RAGFlow 资源

2. **验证 RAGFlow 配置**
   - 访问 RAGFlow 控制台 `http://localhost:4154`
   - 查看新建的 Dataset 和 Chat

### 7.3 切换工作区

1. **桌面端**
   - 点击顶部工作区名称（如"默认"）
   - 选择其他工作区

2. **移动端**
   - 暂不支持（待实现）

### 7.4 发送消息

1. **发送普通消息**
   - 选择工作区
   - 输入内容并发送
   - 消息自动同步到该工作区的 RAGFlow 知识库

2. **AI 助手调用**（待实现）
   - `@goldierill` - OpenAI 直接回答
   - `@ragflow` - RAGFlow 知识库检索

---

## 8. Workspace 隔离机制

### 8.1 数据隔离原理

WhiteNote 的 Workspace 隔离机制通过以下方式实现：

#### 消息（Message）隔离
- **数据库层**: Message 模型有 `workspaceId` 字段，每条消息都属于特定 Workspace
- **API 层**: 所有消息相关 API 都支持 `workspaceId` 过滤参数
- **权限检查**: `/api/messages/[id]` 验证消息的 `authorId` 或系统消息权限

#### 评论（Comment）隔离
- **间接关联**: Comment 模型没有直接的 `workspaceId` 字段，通过 `messageId` 关联到 Message
- **权限继承**: 评论继承其所属消息的权限（只有消息作者可以查看评论）
- **API 保护**: 所有评论相关 API 都验证父消息的权限：
  - `/api/comments/[id]` - 验证 `message.authorId`
  - `/api/comments/[id]/children` - 验证父评论的消息权限
  - `/api/comments/[id]/path` - 验证目标评论的消息权限

#### Tags 页面隔离
- **完整过滤**: `getGraphData(workspaceId)` 同时过滤：
  - Messages（通过 `workspaceId` 字段）
  - Comments（通过 `message.workspaceId` 关联）
  - Retweets（通过关联的 message/comment 的 workspace）

### 8.2 权限规则

#### 消息访问权限
```typescript
// 规则：只有消息作者或系统消息作者可以访问
if (message.authorId !== null && message.authorId !== session.user.id) {
  return 403 Forbidden
}
```

#### 评论访问权限
```typescript
// 规则：评论继承其所属消息的权限
if (comment.message.authorId !== null && comment.message.authorId !== session.user.id) {
  return 403 Forbidden
}
```

#### 系统消息（晨报）
- `authorId = null` 的消息为系统生成的晨报
- 所有用户都可以查看，但受 workspaceId 过滤限制
- 每个 Workspace 的晨报是独立的

### 8.3 API 端点权限矩阵

| 端点 | Workspace 过滤 | 权限检查 |
|------|----------------|----------|
| `GET /api/messages` | ✅ 支持 | N/A (列表只返回自己的消息) |
| `GET /api/messages/[id]` | N/A | ✅ 验证 authorId |
| `GET /api/comments/[id]` | N/A | ✅ 验证 message.authorId |
| `GET /api/comments/[id]/children` | N/A | ✅ 验证父评论的消息权限 |
| `GET /api/comments/[id]/path` | N/A | ✅ 验证目标评论的消息权限 |
| `GET /tags` (Server Action) | ✅ 支持 | N/A (列表只返回自己的消息) |

---

## 9. 故障排查

### 9.1 Worker 日志显示 "Workspace has no RAGFlow dataset"

**原因**：工作区没有初始化 RAGFlow 资源

**解决方案**：
1. 访问 `/settings/workspaces`
2. 找到对应工作区
3. 点击 🗄️ 数据库图标初始化 RAGFlow
4. 检查 RAGFlow API 配置是否正确

### 8.2 消息未同步到 RAGFlow

**检查步骤**：
1. 查看 Worker 日志：`pnpm worker`
2. 确认 Workspace 的 `ragflowDatasetId` 不为空
3. 确认 `enableAutoTag` 开关状态
4. 检查 RAGFlow 服务是否运行：`http://localhost:4154`

### 8.3 页面不断刷新

**已修复**：移除了 `LeftSidebar` 和 `MobileNav` 中冗余的 `getCurrentUser()` API 调用

### 8.4 `/settings/workspaces` 404

**已修复**：创建了 `src/app/settings/workspaces/page.tsx` 文件

---

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `prisma/schema.prisma` | 修改 | 新增 Workspace 模型，修改 Message、AiConfig、User |
| `src/lib/ragflow/provision.ts` | 新建 | RAGFlow 资源自动配置 |
| `src/app/api/workspaces/route.ts` | 新建 | Workspace CRUD API |
| `src/app/api/workspaces/[id]/route.ts` | 新建 | 单个 Workspace 操作 |
| `src/app/api/workspaces/[id]/initialize-ragflow/route.ts` | 新建 | 为现有 Workspace 初始化 RAGFlow |
| `src/app/api/messages/route.ts` | 修改 | 支持 workspaceId 过滤，系统消息也应用过滤 |
| `src/app/api/messages/[id]/route.ts` | 修改 | 更新时同步到 RAGFlow，添加权限检查 |
| `src/app/api/messages/[id]/comments/route.ts` | 修改 | 支持 workspaceId，添加到队列 |
| `src/app/api/comments/[id]/route.ts` | 修改 | 更新时同步到 RAGFlow，添加 GET 权限检查 |
| `src/app/api/comments/[id]/children/route.ts` | 修改 | 添加权限检查 |
| `src/app/api/comments/[id]/path/route.ts` | 修改 | 添加权限检查 |
| `src/lib/ai/ragflow.ts` | 修改 | 所有函数增加 datasetId 参数 |
| `src/lib/ai/config.ts` | 修改 | 移除 Workspace 级别字段 |
| `src/lib/api/workspaces.ts` | 新建 | Workspace API 客户端 |
| `src/lib/api/messages.ts` | 修改 | 增加 workspaceId 参数 |
| `src/lib/knowledge-base.ts` | 修改 | 支持传入 datasetId |
| `src/lib/queue/processors/sync-ragflow.ts` | 修改 | 支持 workspaceId |
| `src/lib/queue/processors/auto-tag.ts` | 修改 | 检查 Workspace enableAutoTag |
| `src/lib/queue/processors/auto-tag-extended.ts` | 修改 | 支持 comments，检查 Workspace enableAutoTag |
| `src/store/useWorkspaceStore.ts` | 新建 | Zustand 状态管理 |
| `src/app/page.tsx` | 修改 | Workspace 切换器 UI |
| `src/app/settings/page.tsx` | 修改 | 添加 Workspace 管理入口 |
| `src/app/settings/workspaces/page.tsx` | 新建 | Workspace 管理页面 |
| `src/components/WorkspaceManager.tsx` | 新建 | Workspace 管理组件 |
| `src/components/InputMachine.tsx` | 修改 | 发送时携带 workspaceId |
| `src/components/MessagesList.tsx` | 修改 | 按 workspaceId 过滤 |
| `src/components/layout/LeftSidebar.tsx` | 修改 | 移除冗余 API 调用 |
| `src/components/layout/MobileNav.tsx` | 修改 | 移除冗余 API 调用 |
| `src/actions/graph.ts` | 修改 | 支持按 Workspace 过滤，comments 和 retweets 也应用过滤 |
| `src/app/tags/page.tsx` | 修改 | 传递 workspaceId 到 getGraphData |
| `src/types/api.ts` | 修改 | 更新类型定义 |

---

## 后续待实现功能

1. **AI 助手调用**
   - `@goldierill` - OpenAI 直接回答
   - `@ragflow` - RAGFlow 知识库检索
   - 修改 `src/app/api/ai/chat/route.ts`
   - 修改 `src/components/InputMachine.tsx`

2. **移动端 Workspace 切换**
   - 在 MobileNav 中添加 Workspace 切换器 （已添加）

3. **跨 Workspace 搜索**
   - 全局搜索模式，聚合多个 Workspace 的搜索结果 （先不修改）

---

## 参考文档

- [HttpAPIRAGFlow/README.md](../HttpAPIRAGFlow/README.md) - RAGFlow API 参考
- [HttpAPIRAGFlow/createRAGFlow.js](../HttpAPIRAGFlow/createRAGFlow.js) - 创建知识库示例
- [PRODUCT_DESIGN_V2.5.md](./PRODUCT_DESIGN_V2.5.md) - 产品设计文档
