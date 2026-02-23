# AI Chat + Workspace 集成设计方案

## 概述

本文档描述如何将 WhiteNote 的 Workspace 功能与 OpenClaw AI Chat 功能有机结合，实现每个 Workspace 拥有独立 AI 会话和上下文记忆的多租户 AI 架构。

## 目标

- 每个 Workspace 拥有独立的 AI Chat 会话
- AI 助手能够记住每个 Workspace 的对话历史
- 切换 Workspace 时自动切换到对应的 AI 对话上下文
- AI 可访问 Workspace 的 RAGFlow 知识库，提供更智能的回答

---

## 现有系统分析

### Workspace 功能

**核心特点：**
- 多租户设计：用户可创建多个独立的工作空间
- 数据隔离：消息、评论、媒体文件都归属于特定 Workspace
- 独立 AI 配置：每个 Workspace 有自己的 RAGFlow 配置（`ragflowDatasetId`, `ragflowChatId`）
- AI 功能开关：`enableAutoTag`（自动打标签）、`enableBriefing`（每日简报）
- 默认 Workspace：新用户自动创建"默认" workspace，且不能删除

**关键文件：**
| 文件路径 | 说明 |
|---------|------|
| [`prisma/schema.prisma`](../prisma/schema.prisma) | 数据库 Schema 定义 |
| [`src/app/api/workspaces/route.ts`](../src/app/api/workspaces/route.ts) | Workspace CRUD API |
| [`src/store/workspace.ts`](../src/store/workspace.ts) | Zustand 状态管理 |
| [`src/lib/ragflow/provision.ts`](../src/lib/ragflow/provision.ts) | RAGFlow 资源自动配置 |

### AI Chat 功能 (OpenClaw)

**核心特点：**
- WebSocket 连接到 OpenClaw Gateway
- 支持多会话（Session）管理，每个 sessionKey 代表独立对话上下文
- SSE 流式传输，实时显示 AI 回答
- 设备身份认证（Ed25519）获取历史记录权限
- 支持 thinking blocks、tool calls、tool results

**关键文件：**
| 文件路径 | 说明 |
|---------|------|
| [`src/lib/openclaw/gateway.ts`](../src/lib/openclaw/gateway.ts) | WebSocket 客户端实现 |
| [`src/lib/openclaw/types.ts`](../src/lib/openclaw/types.ts) | OpenClaw 协议类型定义 |
| [`src/lib/openclaw/deviceIdentity.ts`](../src/lib/openclaw/deviceIdentity.ts) | Ed25519 设备身份 |
| [`src/app/api/openclaw/sessions/route.ts`](../src/app/api/openclaw/sessions/route.ts) | 会话管理 API |
| [`src/app/api/openclaw/chat/stream/route.ts`](../src/app/api/openclaw/chat/stream/route.ts) | SSE 流式聊天 API |
| [`src/app/api/openclaw/chat/history/route.ts`](../src/app/api/openclaw/chat/history/route.ts) | 聊天历史 API |
| [`src/components/OpenClawChat/ChatWindow.tsx`](../src/components/OpenClawChat/ChatWindow.tsx) | 聊天 UI 组件 |
| [`src/components/OpenClawChat/api.ts`](../src/components/OpenClawChat/api.ts) | 前端 API 客户端 |

**当前限制：**
- 使用固定的 `main` sessionKey
- AI Chat 与 Workspace 功能完全独立，没有关联

---

## 集成架构设计

### 核心概念：每个 Workspace = 独立的 AI 大脑

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Account                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐ │
│  │   Workspace 1       │  │   Workspace 2       │  │  Workspace 3 │ │
│  │   "工作项目"        │  │   "个人笔记"        │  │   "学习笔记" │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├──────────────┤ │
│  │ AI Session:         │  │ AI Session:         │  │ AI Session:  │ │
│  │ workspace-{id}      │  │ workspace-{id}      │  │ workspace-{} │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├──────────────┤ │
│  │ 独立聊天历史        │  │ 独立聊天历史        │  │ 独立聊天历史 │ │
│  │ 专属上下文记忆      │  │ 专属上下文记忆      │  │ 专属上下文   │ │
│  │ 专属 RAGFlow 知识库 │  │ 专属 RAGFlow 知识库 │  │ 专属知识库   │ │
│  └─────────────────────┘  └─────────────────────┘  └──────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据库 Schema 扩展

在 [`prisma/schema.prisma`](../prisma/schema.prisma) 中扩展 `Workspace` 模型：

```prisma
model Workspace {
  id                String    @id @default(cuid())
  name              String
  description       String?
  isDefault         Boolean   @default(false)

  // 现有 RAGFlow 配置
  ragflowDatasetId  String?
  ragflowChatId     String?

  // 现有 AI 功能开关
  enableAutoTag     Boolean   @default(true)
  enableBriefing    Boolean   @default(true)

  // ===== 新增：OpenClaw AI Chat 集成 =====
  // OpenClaw 会话标识 (格式: "workspace-{workspaceId}")
  openclawSessionKey     String?  @unique

  // AI Chat 功能开关
  enableAIChat           Boolean  @default(true)

  // AI 会话个性化设置
  aiSystemPrompt         String?  // 自定义系统提示词
  aiModel                String?  // 使用的 AI 模型
  aiTemperature          Float?   @default(0.7)  // AI 创造性程度 (0-1)
  aiMaxTokens            Int?     @default(2000) // 最大输出长度

  // 会话统计
  aiChatMessageCount     Int      @default(0)  // 该 workspace 的 AI 消息数
  lastAIChatAt           DateTime?             // 最后一次 AI 聊天时间

  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages          Message[]

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([openclawSessionKey])
  @@unique([userId, name])
}
```

---

## API 设计

### 1. 获取 Workspace AI 聊天历史

**端点：** `GET /api/workspaces/[id]/ai/chat/history`

**参数：**
- `limit`: 可选，返回消息数量限制

**响应：**
```json
{
  "workspaceId": "workspace-id",
  "sessionKey": "workspace-workspace-id",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "用户消息",
      "timestamp": 1234567890
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "AI 回答",
      "timestamp": 1234567891,
      "thinking": "...",
      "toolCalls": [...]
    }
  ]
}
```

**实现位置：** `src/app/api/workspaces/[id]/ai/chat/history/route.ts`

### 2. 发送消息到 Workspace AI（流式）

**端点：** `POST /api/workspaces/[id]/ai/chat/stream`

**请求体：**
```json
{
  "content": "用户消息内容"
}
```

**响应：** SSE 流式事件
```
data: {"type":"start","sessionKey":"workspace-xxx"}

data: {"type":"content","delta":"部分","content":"部分"}

data: {"type":"finish","runId":"...","usage":{...}}
```

**实现位置：** `src/app/api/workspaces/[id]/ai/chat/stream/route.ts`

### 3. 更新 Workspace AI 配置

**端点：** `PATCH /api/workspaces/[id]/ai/config`

**请求体：**
```json
{
  "enableAIChat": true,
  "aiSystemPrompt": "你是一个专业的项目管理助手...",
  "aiModel": "claude-sonnet-4",
  "aiTemperature": 0.7,
  "aiMaxTokens": 2000
}
```

**实现位置：** 扩展 `src/app/api/workspaces/[id]/route.ts`

### 4. 重置 Workspace AI 会话

**端点：** `POST /api/workspaces/[id]/ai/session/reset`

**功能：**
- 清空当前 Workspace 的 AI 对话历史
- 重新创建 OpenClaw session
- 重置消息计数

**实现位置：** `src/app/api/workspaces/[id]/ai/session/reset/route.ts`

### 5. 批量获取 Workspace AI 状态

**端点：** `GET /api/workspaces/ai-status`

**响应：**
```json
{
  "workspaces": [
    {
      "id": "...",
      "name": "工作项目",
      "enableAIChat": true,
      "aiChatMessageCount": 42,
      "lastAIChatAt": "2026-02-23T10:30:00Z",
      "sessionKey": "workspace-..."
    }
  ]
}
```

**实现位置：** `src/app/api/workspaces/ai-status/route.ts`

---

## 前端实现

### ChatWindow 组件改造

**文件：** [`src/components/OpenClawChat/ChatWindow.tsx`](../src/components/OpenClawChat/ChatWindow.tsx)

**改动：**
```tsx
interface ChatWindowProps {
  workspaceId?: string  // 新增：接收 workspaceId
  sessionKey?: string   // 可选：如果不传则根据 workspaceId 获取
}

// 如果提供了 workspaceId，使用 workspace-aware 的 API
const apiBase = workspaceId
  ? `/api/workspaces/${workspaceId}/ai/chat`
  : '/api/openclaw/chat'

// 加载历史时传入 workspaceId
const history = await openclawApi.getWorkspaceHistory(workspaceId)

// 发送消息时使用 workspace-aware 的 endpoint
await openclawApi.sendWorkspaceMessage(workspaceId, content, ...)
```

### Workspace 切换联动

**文件：** [`src/store/workspace.ts`](../src/store/workspace.ts)

**新增状态：**
```typescript
interface WorkspaceStore {
  currentWorkspace: Workspace | null

  // 新增：当前 Workspace 的 AI 状态
  currentWorkspaceAIStatus: {
    enableAIChat: boolean
    aiChatMessageCount: number
    lastAIChatAt: Date | null
  } | null

  // 切换 Workspace 时重新加载 AI Chat
  switchWorkspace: (id: string) => Promise<void>
}
```

### UI 布局建议

**文件：** `src/app/aichat/page.tsx` 或新增 `src/app/[workspace]/aichat/page.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  WhiteNote                           [Workspace: 工作项目 ▼] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────────────────────────┐  │
│  │ Workspace   │  │                                 │  │
│  │   列表       │  │      AI Chat Window             │  │
│  │             │  │                                 │  │
│  │ ▶ 工作项目   │  │  🤖 助手: 工作                  │  │
│  │   个人笔记   │  │  ───────────────────────────    │  │
│  │   学习笔记   │  │  用户: 帮我总结今天的工作        │  │
│  │             │  │                                 │  │
│  │ [+ 新建]     │  │  🤖 工作助手: 根据你的消息...    │  │
│  │             │  │                                 │  │
│  │             │  │  [⚙️ AI 设置]                   │  │
│  └─────────────┘  └─────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 实现步骤

### Phase 1: 数据库和后端基础

1. ✅ 更新 [`prisma/schema.prisma`](../prisma/schema.prisma) 添加 AI Chat 字段
2. ✅ 运行 `pnpm prisma db push` 更新数据库
3. ✅ 创建 Workspace AI 会话自动初始化逻辑
4. ✅ 实现 workspace-aware 的 AI Chat API

### Phase 2: 前端适配

5. ✅ 改造 [`ChatWindow.tsx`](../src/components/OpenClawChat/ChatWindow.tsx) 支持 workspaceId
6. ✅ 更新 [`api.ts`](../src/components/OpenClawChat/api.ts) 添加 workspace-aware 方法
7. ✅ 在 workspace store 中集成 AI 状态

### Phase 3: UI 集成

8. ✅ 在主界面添加 AI Chat 入口
9. ✅ 实现 Workspace 切换时 AI Chat 自动切换
10. ✅ 添加 Workspace AI 设置界面

### Phase 4: 高级功能

11. ⚙️ AI 可访问 Workspace 历史消息作为上下文
12. ⚙️ AI 可引用 Workspace 中的特定消息
13. ⚙️ AI 与 RAGFlow 知识库联动

---

## 核心优势

| 特性 | 说明 |
|------|------|
| **🎯 上下文隔离** | 每个 Workspace 的 AI 不会混淆不同项目的信息 |
| **🧠 个性化助手** | 工作 workspace 用正式助手，个人 workspace 用轻松助手 |
| **📚 知识关联** | AI 可访问该 Workspace 的 RAGFlow 知识库 |
| **🔄 无缝切换** | 切换 Workspace 时自动切换到对应的 AI 对话历史 |
| **💾 持久化** | AI 会话随 Workspace 创建自动创建，删除 workspace 自动清理 |
| **🔧 灵活配置** | 每个 Workspace 可设置不同的 system prompt 和参数 |

---

## 使用场景示例

### 场景 1：多项目管理

```
Workspace A: "公司项目 X"
  └─ AI 助手: 专业技术顾问，记得所有项目需求和技术决策

Workspace B: "个人博客"
  └─ AI 助手: 创作助手，帮助写文章、优化排版

Workspace C: "学习笔记"
  └─ AI 助手: 学习伙伴，帮助总结知识点、出练习题
```

### 场景 2：团队协作

```
Workspace: "设计团队"
  └─ AI: 设计评审助手，记得所有设计决策和品牌规范

Workspace: "开发团队"
  └─ AI: 代码顾问，记得架构设计和技术栈选择
```

### 场景 3：知识库联动

```
用户: "帮我找关于 XXX 的讨论"
AI: [访问该 Workspace 的 RAGFlow 知识库]
    "在你的知识库中找到了 3 条相关记录..."
```

---

## 注意事项

1. **会话命名规范**: OpenClaw sessionKey 格式统一为 `workspace-{workspaceId}`，避免与手动创建的会话冲突
2. **权限控制**: 验证用户是否有权访问指定 Workspace
3. **错误处理**: 当 Workspace 没有 AI 会话时，自动创建而非报错
4. **性能优化**: 历史记录加载限制条数，避免一次性加载过多消息
5. **兼容性**: 保持现有 `/api/openclaw/*` API 可用，支持无 Workspace 的全局 AI Chat

---

## 相关文档

- [AI Chat OpenClaw 实现文档](./AI_CHAT_OPENCLAW.md)
- [项目 CLAUDE.md](../CLAUDE.md)

---

## 待确认问题

1. **迁移策略**: 现有使用 `main` 会话的历史数据如何处理？
2. **权限模型**: 是否允许用户共享 Workspace 的 AI 对话给其他用户？
3. **存储成本**: 每个 Workspace 独立会话会增加 OpenClaw 存储成本，是否需要限制？
4. **UI 位置**: AI Chat 是放在独立的 `/aichat` 页面，还是集成到每个 Workspace 页面？
