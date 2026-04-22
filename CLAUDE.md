# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhiteNote is a collaborative social media platform with AI-enhanced features, combining Twitter/X-style microblogging with workspace organization and real-time collaboration. The application uses a multi-service architecture with Next.js (App Router), PostgreSQL with Prisma, Socket.IO for real-time updates, and RAGFlow integration for AI capabilities.

## Development Commands

### Starting Development (requires 3 terminals)

```bash
# Terminal 1 - Build Next.js (required first)
# If build fails with "Module not found" errors, run these commands first:
rm -rf node_modules .next
pnpm install
pnpm prisma generate
pnpm build

# Terminal 2 - Start development server on http://localhost:3005
pnpm dev

# Terminal 3 - Start background worker for scheduled tasks
pnpm worker
```

### Production

```bash
pnpm start          # Start production server (NODE_ENV=production)
```

### Database Operations

```bash
pnpm prisma db push         # Push schema changes to database
pnpm prisma db seed         # Run seed script (creates built-in templates and AI commands)
pnpm prisma studio          # Open Prisma Studio database UI
pnpm prisma generate        # Generate Prisma client (usually automatic)

# Reset database completely (deletes all data)
docker exec pg16 psql -U myuser -d postgres -c "DROP DATABASE IF EXISTS whitenote;"
docker exec pg16 psql -U myuser -d postgres -c "CREATE DATABASE whitenote;"
pnpm prisma db push
pnpm prisma db seed
```

### Other Commands

```bash
pnpm seed:ai-commands      # Seed AI commands only
pnpm lint                  # Run ESLint
```

## Architecture

### Multi-Service Structure

The application consists of three main services:

1. **Next.js App** (`server.ts`): Main web server with App Router architecture
2. **Background Worker** (`scripts/worker.ts`): Handles scheduled tasks and background jobs
3. **Socket.IO Server**: Integrated into the main server for real-time messaging

### Workspace-Centric Design

- Users can create multiple workspaces
- Each workspace has independent RAGFlow AI configurations
- Messages are scoped to workspaces
- AI features (auto-tagging, daily briefings) are configured per workspace
- Default workspace is automatically created for new users

### AI Integration Layers

The platform has four AI integration layers:

1. **Detection Layer**: AI mention detection (`@goldierill` or `@ragflow`) in messages triggers automated responses
2. **RAG Layer**: Knowledge base chat integration with RAGFlow
3. **Command Layer**: Pre-defined AI commands stored in database (seeded via `prisma/seed-ai-commands.ts`)
4. **Automated Layer**: Scheduled tasks for auto-tagging and daily briefings

### Real-Time Features

Socket.IO integration (`src/lib/socket/`) handles:
- Message creation, editing, and deletion broadcasts
- Comment and reply notifications
- Real-time collaboration features

### Content Management

- **TipTap Editor**: Rich text editing with markdown support (`src/components/InputMachine/`)
- **Media Handling**: Custom upload API supports images (jpg, png, webp) and videos (mp4, mov) with 100MB limit
- **Message Versioning**: Edit history tracking in database
- **Tag System**: Auto-tagging via AI, manual tags
- **Social Features**: Retweets/quotes, nested comments, starring, pinning

### Background Job Processing

BullMQ with Redis (`src/lib/queue/`) for:
- Scheduled daily briefings
- AI-powered auto-tagging
- Async media processing

## Key Directories

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (auth, messages, media)
│   │   ├── openclaw/      # OpenClaw API 代理（chat/stream, chat/history, sessions）
│   │   └── hermes/        # Hermes API 代理（chat/stream, chat/history, sessions, health）
│   ├── aichat/            # AI Chat 页面（OpenClaw / Hermes 双后端）
│   ├── page.tsx           # 首页 (Home page)
│   ├── status/[id]/       # 帖子详情页面 (Message detail page)
│   │   ├── page.tsx       # 帖子详情页
│   │   ├── reply/page.tsx # 移动端回复页面 (Mobile reply page)
│   │   └── comment/[commentId]/
│   │       ├── page.tsx   # 评论详情页 (Comment detail page)
│   │       └── reply/page.tsx # 移动端评论回复页面 (Mobile comment reply page)
│   ├── retweet/page.tsx   # 移动端转发页面 (Mobile retweet page)
│   ├── share/[id]/        # 公开分享页面 (Public share page)
│   └── [workspace]/       # Workspace-scoped pages
├── components/            # React components
│   ├── InputMachine.tsx   # 主页输入组件 (Main input component with TipTap editor)
│   ├── ReplyDialog.tsx    # 回复对话框组件 (Reply dialog component)
│   ├── RetweetDialog.tsx  # 转发对话框组件 (Retweet/quote dialog component)
│   ├── ShareDialog.tsx    # 分享对话框组件 (Share dialog component)
│   ├── CompactReplyInput.tsx # 紧凑回复输入组件 (Compact reply input component)
│   ├── CommentsList.tsx   # 评论列表组件 (Comments list component)
│   ├── MessageCard.tsx    # 主消息卡片组件 (Main message card component)
│   ├── QuotedMessageCard.tsx # 引用消息卡片组件 (Quoted message card component)
│   ├── ActionRow.tsx      # 操作按钮行组件 (Action buttons row component)
│   ├── TipTapViewer.tsx   # 富文本查看器组件 (Rich text viewer component)
│   ├── MediaGrid.tsx      # 媒体网格显示组件 (Media grid display component)
│   ├── ImageLightbox.tsx  # 图片灯箱组件 (Image lightbox component)
│   ├── GoldieAvatar.tsx   # AI/用户头像组件 (AI/User avatar component)
│   ├── layout/            # 布局组件 (Layout components)
│   │   ├── MainLayout.tsx # 主布局组件
│   │   ├── LeftSidebar.tsx # 左侧边栏 (Desktop left sidebar)
│   │   ├── RightSidebar.tsx # 右侧边栏 (Desktop right sidebar with search)
│   │   └── MobileNav.tsx   # 移动端导航 (Mobile navigation)
│   ├── InputMachine/      # TipTap editor with AI integration
│   └── MessagesList/      # Message display with real-time updates
│   └── OpenClawChat/      # AI Chat components
│       ├── ChatWindow.tsx      # 对话主窗口组件（支持 OpenClaw/Hermes 双后端）
│       ├── AIMessageViewer.tsx # AI 消息渲染组件（支持 thinking、tool call 等内容块）
│       ├── SessionSelector.tsx # OpenClaw 会话选择器组件
│       ├── HermesSessionSelector.tsx # Hermes 会话选择器组件
│       ├── api.ts              # OpenClaw API 客户端（流式、历史消息）
│       ├── hermes-api.ts       # Hermes API 客户端（流式、会话列表）
│       └── types.ts            # 前端类型定义
├── lib/
│   ├── socket/           # Socket.IO server configuration
│   ├── queue/            # BullMQ job queue setup
│   ├── ai/               # RAGFlow and AI service integrations
│   └── openclaw/         # OpenClaw Gateway 核心库
│       ├── gateway.ts        # WebSocket 客户端实现
│       ├── types.ts          # 协议类型定义（帧、消息结构）
│       ├── deviceIdentity.ts # 设备身份生成与签名
│       └── deviceAuthStore.ts # 设备认证 Token 存储
├── store/                # Zustand state management
├── hooks/                # Custom React hooks
│   ├── use-share.ts      # 分享功能 Hook (Share functionality hook)
│   └── use-mobile.ts     # 移动端检测 Hook (Mobile detection hook)
└── types/                # TypeScript type definitions
prisma/
├── schema.prisma         # Database schema
└── seed-ai-commands.ts   # Seed script for AI commands
scripts/
├── worker.ts             # Background worker process
HttpAPIRAGFlow/           # RAGFlow API automation scripts and documentation
```

## AI Chat 集成

AI Chat 页面（`/aichat`）支持两个后端，用户可在页面上方切换：

### 后端一：OpenClaw Gateway

WebSocket 协议与 OpenClaw Gateway 通信，支持设备认证、多会话、流式响应。

**配置**（`.env.local`）：
```env
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_TOKEN=your-openclaw-token
```

**前提**：需要运行 OpenClaw Gateway（端口 18789）。

**关键文件**：
- `src/lib/openclaw/gateway.ts` — WebSocket 客户端（EventEmitter、v3 签名、backend 模式）
- `src/lib/openclaw/deviceIdentity.ts` — ECDSA 设备身份与 v3 签名载荷
- `src/lib/openclaw/types.ts` — 协议类型（RequestFrame、ResponseFrame、EventFrame）
- `src/components/OpenClawChat/api.ts` — 前端 API 客户端
- `src/components/OpenClawChat/SessionSelector.tsx` — 会话选择器

**API 端点**：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/openclaw/chat/stream` | POST | 流式聊天，返回 SSE 流 |
| `/api/openclaw/chat/history` | GET | 获取历史消息 |
| `/api/openclaw/sessions` | GET/POST | 列出/创建会话 |
| `/api/openclaw/sessions/[key]` | PATCH/DELETE | 更新/删除会话 |

**数据流**：
1. `ChatWindow` 调用 `/api/openclaw/chat/stream`
2. API 内部通过 `createGlobalGateway(token)` 建立 WebSocket 连接
3. Gateway 完成 v3 设备认证后发送 `chat.send`
4. AI 响应通过 `chat` 事件流推送，API 转换为 SSE 格式

**内容块类型**：text（文本）、thinking（推理过程）、tool_call（工具调用）、tool_result（工具结果）

### 后端二：Hermes Agent

通过 Hermes API Server（OpenAI 兼容协议）通信，支持 tool calling、会话持久化、流式响应。

**配置**：

1. 在 Hermes 侧（`~/.hermes/.env`）启用 API Server：
```env
API_SERVER_ENABLED=true
API_SERVER_KEY=your-secret-key
```

2. 在 WhiteNote 侧（`.env.local`）添加：
```env
HERMES_API_URL=http://localhost:8642
HERMES_DASHBOARD_URL=http://localhost:9119
HERMES_API_KEY=your-secret-key
```

**前提**：需要运行 Hermes Gateway（`hermes gateway run`），API Server 会自动在端口 8642 启动，Dashboard 在端口 9119。

**架构**：

```
WhiteNote Frontend
  → /api/hermes/*（Next.js API 路由代理）
    → Hermes API Server (localhost:8642)
      → POST /v1/chat/completions（SSE 流式）
    → Hermes Dashboard (localhost:9119)
      → GET /api/sessions（会话列表）
      → GET /api/sessions/{id}/messages（历史消息）
```

**关键文件**：

| 文件路径 | 说明 |
|----------|------|
| `src/app/api/hermes/chat/stream/route.ts` | SSE 代理：将 OpenAI chat/completions 格式转为内部格式 |
| `src/app/api/hermes/chat/history/route.ts` | 历史消息代理（自动提取 Dashboard session token） |
| `src/app/api/hermes/sessions/route.ts` | 会话列表代理（自动提取 Dashboard session token） |
| `src/app/api/hermes/health/route.ts` | 健康检查 |
| `src/components/OpenClawChat/hermes-api.ts` | 前端 Hermes API 客户端 |
| `src/components/OpenClawChat/HermesSessionSelector.tsx` | Hermes 会话选择器 |

**Dashboard 认证**：Hermes Dashboard 的 session token 是每次启动随机生成的，注入到 SPA 的 HTML 中。WhiteNote 代理路由会自动从 Dashboard 首页提取 token，缓存 5 分钟，401 时自动刷新。

**API Server 认证**：如果 Hermes 配置了 `API_SERVER_KEY`，WhiteNote 需要在 `.env.local` 设置相同的 `HERMES_API_KEY`。本地开发（127.0.0.1）可以不设 key，但 session continuity 功能要求必须设置。

### 共享组件

两个后端共用以下组件：

| 文件路径 | 说明 |
|----------|------|
| `src/components/OpenClawChat/ChatWindow.tsx` | 对话主窗口，通过 `backend` prop 切换 OpenClaw/Hermes |
| `src/components/OpenClawChat/AIMessageViewer.tsx` | AI 消息渲染（支持 thinking、tool call 展示） |
| `src/components/OpenClawChat/types.ts` | 前端类型定义 |
| `src/app/aichat/page.tsx` | 页面入口，包含后端切换按钮和会话选择器 |

### 使用

- 访问 `http://localhost:3005/aichat` 进入 AI 对话页面
- 页面上方有 **OpenClaw** / **Hermes** 切换按钮
- 选择后端后可切换会话（OpenClaw 用 SessionSelector，Hermes 用 HermesSessionSelector）
- 支持流式响应，消息自动保存到 localStorage

## Database Schema Patterns

- **Multi-tenant design**: Most models have `workspaceId` or `userId` relations
- **Cascade deletion**: User/account/session deletions cascade properly
- **Message versioning**: Edit history preserved for auditing
- **AI Command registry**: `AICommand` model stores predefined prompts
- **Social relationships**: `Retweet` model tracks quote/retweet relationships
- **Media metadata**: `Media` model tracks file uploads separately from messages

## Important Constraints

- All three services (dev server, worker, database) must be running for full functionality
- Build step required before running dev server (`pnpm build && pnpm dev`)
- Database must be seeded for AI commands to work
- RAGFlow integration requires external service configuration per workspace
