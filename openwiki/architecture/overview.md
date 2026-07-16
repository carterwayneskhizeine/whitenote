# 架构总览

本文梳理 Mirror 的整体技术架构：App Router 路由划分、客户端 / 服务端边界、认证、API 请求生命周期以及后台任务系统。

## 整体分层

```
浏览器 (React 19 + TipTap + Zustand)
   │
   │  fetch / sessionStorage
   ▼
Next.js App Router (src/app)
   ├── app/                  # 页面（默认 RSC，按需 'use client'）
   │   └── api/**/route.ts   # 路由处理器（Node runtime）
   │
   ▼
Lib 层 (src/lib)
   ├── ai/                   # OpenAI / RAG / RAGFlow / 线程上下文
   ├── api/                  # 浏览器侧 API 客户端
   ├── prisma.ts             # PrismaClient 单例
   ├── queue.ts              # 后台任务队列
   ├── storage.ts            # sessionStorage 封装
   ├── stores/               # Zustand 全局状态
   ├── utils/                # 纯函数（ai-detection 等）
   └── md-sync/              # Markdown 同步相关（可选目录）
   │
   ▼
数据 / 外部服务
   ├── SQLite (file:./dev.db)            # 主库
   ├── OpenAI 兼容接口                    # 对话 / Embedding / 自动打标
   ├── RAGFlow（可选）                    # RAG 回退后端
   └── SiliconFlow（可选）                # 语音转写（TeleSpeechASR）
```

## App Router 目录约定

`src/app/` 顶层目录对应路由：

| 路径 | 作用 |
| --- | --- |
| `src/app/api/**` | 后端 API 路由（`route.ts` 形式） |
| `src/app/page.tsx` | 首页（时间线） |
| `src/app/workspace/[id]/page.tsx` | 单个 Workspace 的时间线 |
| `src/app/messages/[id]/page.tsx` | 单条消息详情 |
| `src/app/messages/[id]/comments/[commentId]/page.tsx` | 锚定到某条评论 |
| `src/app/search/page.tsx` | 搜索结果 |
| `src/app/settings/page.tsx` | 设置入口 |
| `src/app/settings/ai-config/page.tsx` | AI 模型与 Embedding 配置 |
| `src/app/settings/ai-commands/page.tsx` | AI 命令管理 |
| `src/app/settings/workspaces/page.tsx` | Workspace 管理 |
| `src/app/signin/page.tsx` | 登录页（NextAuth 流程） |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |

页面层级使用的客户端组件集中在 `src/components/`，服务端逻辑（认证校验、数据库访问、AI 调用）则在 `src/lib/` 与 `src/app/api/`。

## 认证

- 使用 NextAuth + Prisma Adapter。
- 服务端入口：`src/app/api/auth/[...nextauth]/route.ts`。
- 在受保护的 API 路由中通过 `requireAuth()`（位于 `src/lib/api-auth.ts`）统一鉴权，失败时抛出 `AuthError`，handler 捕获后返回 401。
- 客户端通过 `next-auth/react` 的 `useSession()` 读取会话，并在 `src/components/Header.tsx` 等位置控制未登录重定向。

## API 路由形态

- 所有 `src/app/api/**/route.ts` 都是 Node.js runtime（`export const runtime = 'nodejs'`）。
- 标准响应外壳（来自 `src/types/api.ts`）：
  ```ts
  interface ApiResponse<T> { data?: T; error?: string; meta?: {...} }
  ```
- 列表类接口通常返回 `{ data: T[], meta?: { total, page, limit, totalPages } }`。
- 错误统一返回 `{ error: string }` 并设置对应 HTTP 状态码。

## 客户端 ↔ 服务端数据流

典型链路（以「时间线加载」为例）：

1. 页面（多数为 RSC）调用 `messagesApi.getMessages({ workspaceId, page })`，内部 `fetch('/api/messages?...')`。
2. `/api/messages` handler 通过 `requireAuth()` 校验会话，使用 Prisma 查询并返回 JSON。
3. 客户端组件接收结果后渲染 `MessageItem` / `MessageList`；通过 SWR 或本地 state 维护分页与缓存。
4. 写操作（发帖、评论、Star、转发、AI 调用）直接 `POST/PUT/DELETE` 到对应 `route.ts`，并通过 `useToast` 反馈成功 / 失败。

## 后台任务（`src/lib/queue.ts`）

- 仓库使用一个轻量的内存 / 文件型队列（`addTask(type, payload)`）。
- 典型任务类型（出现在源码中）：
  - `process-message`：消息创建后异步处理（打标、生成链接建议、向量化等）。
  - `sync-rag`：将消息同步进向量索引（RAG）；**会过滤 `isAIBot=true` 的评论**，确保 AI 回复不被反复检索。
  - `auto-tag-message` / `auto-tag-comment`：根据 Workspace 配置自动打标。
  - `search-message`：执行搜索后端任务。
- 任务的执行入口通常在服务端 `route.ts` 创建资源后立即 `await addTask(...)`；后续任务的具体 worker 实现在初始化阶段未被深入阅读，可在后续 update 中补全。

## 客户端全局状态

- **Workspace**：`src/lib/stores/workspace.ts`（Zustand）持有当前 workspace id，持久化到 localStorage；几乎所有列表接口都会把它当作 filter。
- **ASR 配置**：因 API Key 写在浏览器侧，使用 `sessionStorage.asr_api_key`，封装在 `src/lib/storage.ts`。组件通过 `storage` 事件跨标签页同步。
- **AI Streaming**：回复态由组件本地 state 维护（`aiStreamingResponse` / `isAiStreaming`），不走全局 store。

## 关键设计取舍

- **SQLite + Prisma**：单文件部署简单、迁移可重放；通过 `prisma/migrations/` 管理 schema 演进。
- **RAG 主路径用 sqlite-vec**：避免对外部 RAGFlow 的强依赖；RAGFlow 仅作为回退后端，要求 Workspace 关联 `ragflowChatId`。
- **AI 调用统一在服务端**：所有 `/api/ai/*` 都是服务端调用，OpenAI Key 不直接暴露给浏览器；ASR 是唯一在客户端直连外部 API 的模块（按设计选择）。
- **客户端组件边界最小化**：仅交互密集的输入器（`InputMachine`、`CommentsList`、`PostDialog`、`ReplyDialog`、`RetweetDialog` 等）标记 `'use client'`。

## 阅读建议

- 第一次接触代码：从 `src/app/page.tsx` → `src/components/MessageList.tsx` → `src/components/MessageItem.tsx` → `src/components/CommentsList.tsx` 走一遍渲染流程。
- 调试 API：直接打开对应 `src/app/api/**/route.ts`，通常 200 行以内即可读完一条路径。
- 改动数据模型：先读 `architecture/data-model.md`，再生成 `prisma migrate dev`。