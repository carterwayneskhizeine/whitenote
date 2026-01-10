# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server (includes Socket.IO server)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Database operations
pnpm prisma db push        # Push schema changes to database
pnpm prisma studio         # Open Prisma Studio UI
pnpm prisma generate       # Generate Prisma client

# Run background worker (processes async tasks like AI tagging, RAGFlow sync)
pnpm worker

# Seed AI commands
pnpm seed:ai-commands
```

## Architecture Overview

WhiteNote is a full-stack Next.js application with real-time capabilities and AI integration.

### Server Architecture

- **Custom Server** ([`server.ts`](server.ts)): Wraps Next.js with a custom HTTP server that initializes Socket.IO
- **Development Port**: 3005 (configurable via `PORT` env var)
- **Runtime**: Uses `tsx` for TypeScript execution

### Real-Time System

- **Socket.IO Server** ([`src/lib/socket/server.ts`](src/lib/socket/server.ts)): Initialized at `/api/socket`
  - Handles real-time editing collaboration (edit:start, edit:stop, sync:content events)
  - Session-based authentication via NextAuth cookies
  - Room-based messaging for multi-user editing

### Background Job System

- **Queue**: BullMQ with Redis backend ([`src/lib/queue/index.ts`](src/lib/queue/index.ts))
- **Worker** ([`src/lib/queue/worker.ts`](src/lib/queue/worker.ts)): Processes async tasks
  - `auto-tag`: Automatically extracts tags from message content using AI
  - `sync-ragflow`: Syncs messages to RAGFlow knowledge base
  - `daily-briefing`: Generates daily summaries (cron job at 08:00)
- **Job Processors**: Located in [`src/lib/queue/processors/`](src/lib/queue/processors/)

### Authentication

- **NextAuth 5** ([`src/lib/auth.ts`](src/lib/auth.ts)): Credentials provider with JWT sessions
- **Session Strategy**: JWT (not database sessions)
- **Sign In Page**: `/login`
- **Session Token**: Stored in `next-auth.session-token` or `__Secure-next-auth.session-token` cookie

### Database (Prisma)

- **ORM**: Prisma 7
- **Schema**: [`prisma/schema.prisma`](prisma/schema.prisma)
- **Key Models**:
  - `Message`: Core content model with threading (parentId), quotes (quotedMessageId), tags, versions, aliases, and links
  - `Comment`: Hierarchical comments with quote support
  - `Retweet`: User can retweet both messages and comments
  - `AiConfig`: Per-user AI settings (OpenAI, RAGFlow, auto-tagging, etc.)
  - `AICommand`: Custom AI slash commands

### API Structure

- **Base Path**: `/api`
- **Routes**:
  - `/api/messages`: CRUD operations, star/pin/retweet toggles
  - `/api/comments`: CRUD operations, nested replies, quote support
  - `/api/tags`: Tag management
  - `/api/templates`: Template CRUD
  - `/api/ai/*`: AI endpoints (chat, enhance)
  - `/api/auth/*`: NextAuth and custom auth endpoints
- **API Client**: Typed API functions in [`src/lib/api/`](src/lib/api/) (messages.ts, comments.ts, tags.ts, etc.)

### Frontend Architecture

- **Framework**: Next.js 16 with App Router
- **UI Components**: Radix UI primitives with custom styling
- **State Management**: Zustand ([`src/store/useAppStore.ts`](src/store/useAppStore.ts))
- **Rich Text Editor**: TipTap 3 with custom extensions ([`src/lib/editor/extensions/`](src/lib/editor/extensions/))
  - `SlashCommand`: Triggers AI command menu
  - `AICommandList`: Custom command selector with search/filtering

### AI Integration

- **OpenAI Client** ([`src/lib/ai/openai.ts`](src/lib/ai/openai.ts)): Wraps OpenAI API
- **RAGFlow Client** ([`src/lib/ai/ragflow.ts`](src/lib/ai/ragflow.ts)): Knowledge base retrieval
- **Auto-Tagging** ([`src/lib/ai/auto-tag.ts`](src/lib/ai/auto-tag.ts)): Extracts tags from content

### Environment Configuration

Required services (run via Docker or externally):
- PostgreSQL: `localhost:5925` (via Docker Compose)
- Redis: `localhost:4338` (for queue)
- RAGFlow: `localhost:4154` (optional, for RAG features)
- LiteLLM/OpenAI: `localhost:4000` (optional, for AI features)

Key environment variables (see [`.env`](.env)):
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET` / `NEXTAUTH_SECRET`: JWT secret
- `OPENAI_BASE_URL` / `OPENAI_API_KEY`: AI configuration
- `RAGFLOW_BASE_URL` / `RAGFLOW_API_KEY`: RAGFlow configuration
- `REDIS_URL`: Redis connection for BullMQ

## Key Patterns

### Message Threading and Quotes

Messages support two types of relationships:
- **Threading**: `parentId` for hierarchical message threads
- **Quotes**: `quotedMessageId` for embedding/referencing other messages

Comments can also quote messages via `quotedMessageId`, enabling rich context in discussions.

### Auto-Tagging Flow

When a message is created/updated:
1. If user has `enableAutoTag` enabled in AiConfig
2. Job added to queue: `addTask("auto-tag", { messageId })`
3. Worker processes using configured `autoTagModel`
4. Tags extracted and linked via `MessageTag` junction table
5. Message synced to RAGFlow if `enableRag` is enabled

### TipTap Extension Pattern

Custom extensions in [`src/lib/editor/extensions/`](src/lib/editor/extensions/) follow TipTap's Extension.create() pattern with:
- `addOptions()`: Configuration options
- `addProseMirrorPlugins()`: ProseMirror plugins
- React rendering for UI components (using Tippy.js for popups)

## Important Notes

- Database migrations use `prisma db push` (not migrations in development)
- Worker must be running separately for background tasks to execute
- Socket.IO authentication validates NextAuth session tokens
- TypeScript path alias `@/*` maps to `./src/*`
- All API routes use standard Next.js App Router conventions
