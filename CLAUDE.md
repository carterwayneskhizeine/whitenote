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
├── lib/
│   ├── socket/           # Socket.IO server configuration
│   ├── queue/            # BullMQ job queue setup
│   └── ai/               # RAGFlow and AI service integrations
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

### 关键文件

| 文件 | 说明 |
|------|------|
| `src/lib/openclaw/types.ts` | OpenClaw 协议类型定义 |
| `src/lib/openclaw/gateway.ts` | WebSocket 客户端实现 |
| `src/app/api/openclaw/chat/stream/route.ts` | 流式聊天 API |
| `src/app/api/openclaw/chat/history/route.ts` | 获取聊天历史 API |
| `src/app/api/openclaw/sessions/route.ts` | 会话管理 API |
| `src/components/OpenClawChat/types.ts` | 前端类型定义 |
| `src/components/OpenClawChat/api.ts` | API 客户端 |
| `src/components/OpenClawChat/ChatWindow.tsx` | 对话主组件 |
| `src/app/aichat/page.tsx` | AI Chat 页面 |

### 配置

在 `.env.local` 中添加：
```env
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_TOKEN=your-token-here
```

### 使用

- 访问 `http://localhost:3005/aichat` 进入 AI 对话页面
- 使用固定的 `main` 会话，聊天记录会在刷新后自动从 OpenClaw Gateway 恢复
- 支持流式响应

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
