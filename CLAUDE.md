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
│       ├── ChatWindow.tsx      # 对话主窗口组件
│       ├── AIMessageViewer.tsx # AI 消息渲染组件（支持 thinking、tool call 等内容块）
│       ├── SessionSelector.tsx # 会话选择器组件
│       ├── api.ts              # API 客户端（流式、历史消息）
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

## OpenClaw AI Chat 集成

WhiteNote 集成了 OpenClaw Gateway 作为 AI 对话后端，提供类似 ChatGPT 的 Web UI 对话界面。

### 架构概述

OpenClaw 聊天系统采用 WebSocket 协议与 OpenClaw Gateway 通信，支持：
- **设备认证**：基于 ECDSA 公私钥的设备身份认证
- **会话管理**：多会话支持，会话持久化
- **流式响应**：SSE 格式实时推送 AI 生成内容
- **内容块**：支持 text、thinking、tool_call、tool_result 等多种内容类型

### 关键文件

| 文件路径 | 说明 |
|----------|------|
| `src/app/aichat/page.tsx` | AI Chat 页面入口 |
| `src/components/OpenClawChat/ChatWindow.tsx` | 对话主窗口组件，包含输入框、消息列表 |
| `src/components/OpenClawChat/AIMessageViewer.tsx` | AI 消息渲染组件，支持 thinking 展示和 tool call 渲染 |
| `src/components/OpenClawChat/SessionSelector.tsx` | 会话选择器组件 |
| `src/components/OpenClawChat/api.ts` | 前端 API 客户端，包含流式聊天和历史消息获取 |
| `src/components/OpenClawChat/types.ts` | 前端类型定义（ChatMessage、OpenClawContentBlock 等） |
| `src/lib/openclaw/gateway.ts` | WebSocket 客户端核心实现（OpenClawGateway 类） |
| `src/lib/openclaw/types.ts` | 协议类型定义（RequestFrame、ResponseFrame、EventFrame、ChatEvent 等） |
| `src/lib/openclaw/deviceIdentity.ts` | 设备身份生成与签名（ECDSA 公私钥） |
| `src/lib/openclaw/deviceAuthStore.ts` | 设备认证 Token 存储（持久化到文件系统） |
| `src/app/api/openclaw/chat/stream/route.ts` | 流式聊天 API（POST /api/openclaw/chat/stream） |
| `src/app/api/openclaw/chat/history/route.ts` | 获取聊天历史 API（GET /api/openclaw/chat/history） |
| `src/app/api/openclaw/sessions/route.ts` | 会话管理 API（列表、创建） |
| `src/app/api/openclaw/sessions/[key]/route.ts` | 会话管理 API（更新、删除） |

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/openclaw/chat/stream` | POST | 流式聊天，接收 `{ sessionKey, content, log? }`，返回 SSE 流 |
| `/api/openclaw/chat/history` | GET | 获取历史消息，参数 `sessionKey`, `limit`, `before` |
| `/api/openclaw/sessions` | GET | 列出所有会话 |
| `/api/openclaw/sessions` | POST | 创建新会话 |
| `/api/openclaw/sessions/[key]` | PATCH | 更新会话（如设置 label） |
| `/api/openclaw/sessions/[key]` | DELETE | 删除会话 |

### 前端组件结构

```
ChatWindow
├── SessionSelector          # 会话选择器（下拉菜单）
├── MessagesList            # 消息列表
│   └── AIMessageViewer     # 单条 AI 消息渲染
│       ├── TextBlock       # 文本内容块
│       ├── ThinkingBlock  # thinking/推理过程展示
│       └── ToolCallBlock  # tool_call 工具调用展示
└── InputArea              # 输入区域
```

### 数据流

1. **连接建立**：`ChatWindow` 加载时通过 `api.sendMessage()` 调用 `/api/openclaw/chat/stream`
2. **认证流程**：API 内部调用 `createGlobalGateway(token)` 建立 WebSocket 连接，完成设备认证
3. **消息发送**：用户输入内容后，通过 `gateway.sendMessage(sessionKey, content)` 发送
4. **事件接收**：Gateway 监听 WebSocket 事件，触发 `onEvent` 回调
5. **流式渲染**：API 将事件转换为 SSE 格式推送，前端逐步渲染

### 内容块类型

`OpenClawContentBlock` 支持以下类型：

- **text**：普通文本内容
- **thinking**：AI 推理过程（紫色高亮显示）
- **tool_call**：AI 发起工具调用（显示工具名和参数）
- **tool_result**：工具调用结果

### 配置

在 `.env.local` 中添加：
```env
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_TOKEN=your-token-here
```

### 调试日志

发送请求时传入 `log: true` 可将 AI 事件保存到 `logs/` 目录：
- API 位置：`src/app/api/openclaw/chat/stream/route.ts:44`（参数定义）
- 日志逻辑：`route.ts:93-95`（条件判断）
- 日志格式：JSONL，每行包含时间戳、事件名和事件数据
- 日志文件：`logs/openclaw-{timestamp}.jsonl`

### 使用

- 访问 `http://localhost:3005/aichat` 进入 AI 对话页面
- 使用固定的 `main` 会话，聊天记录会在刷新后自动从 OpenClaw Gateway 恢复
- 支持流式响应
- 支持创建多个会话，会话间数据隔离

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
