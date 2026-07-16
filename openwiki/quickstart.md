# Mirror 知识库快速入门

本目录是 `mirror` 仓库（AI 增强的推文式知识库）的代码维基。所有页面以仓库源码、Prisma 模型与最近的 git 提交为依据。

## 一句话定义

Mirror 是一个基于 Next.js 15 + Prisma + SQLite 的「类推特」知识库：在类推特的时间线/评论流中沉淀笔记与想法，通过 `@goldierill` / `@rag` 提及或语音输入调用大模型，让历史内容成为可对话的知识。

## 技术栈速览

| 维度 | 选型 | 关键位置 |
| --- | --- | --- |
| 框架 | Next.js 15 App Router（React 19、`--turbopack` 开发） | `package.json` `next dev --turbopack` |
| ORM / DB | Prisma + SQLite | `prisma/schema.prisma`、`src/lib/prisma.ts` |
| 认证 | NextAuth + Prisma Adapter | `src/app/api/auth/[...nextauth]/route.ts`、`src/lib/auth.ts` |
| 状态 | Zustand + 本地 storage | `src/lib/stores/workspace.ts`、`src/lib/storage.ts` |
| 富文本 | TipTap（Markdown / Table / CodeBlockLowlight / Image / SlashCommand） | `src/components/InputMachine.tsx` |
| AI | OpenAI 兼容接口 + 自建 RAG（sqlite-vec）+ RAGFlow 回退 | `src/lib/ai/*`、`src/app/api/ai/*` |
| 后台任务 | 自实现的 `addTask` 队列 | `src/lib/queue.ts` |
| 语音转写 | 浏览器 `MediaRecorder` + SiliconFlow TeleSpeechASR | `src/components/InputMachine.tsx` |
| 包管理 | pnpm（`pnpm-lock.yaml`） | 仓库根目录 |

## 目录导览

- 架构总览：`architecture/overview.md` — App Router 分层、请求生命周期、认证、后台任务。
- 数据模型：`architecture/data-model.md` — Prisma schema 中所有核心实体及其关系。
- 内容与互动：`features/posts-and-discussions.md` — 时间线、发帖、引用、转发、评论、排序。
- AI 与 RAG：`features/ai-and-rag.md` — 双提及模式、`@goldierill` / `@rag`、sqlite-vec、RAGFlow、AI 命令、ASR。
- 工作区与知识同步：`features/workspaces-and-knowledge-sync.md` — Workspace 隔离、Markdown 同步、向量索引、AI 评论过滤。
- 运行与运维：`operations/configuration-and-ops.md` — 环境变量、脚本、开发流程、常见故障排查。

## 30 秒上手（开发环境）

```bash
pnpm install
# 复制 .env 文件，填写 DATABASE_URL / NEXTAUTH_SECRET / 至少一个 AI 密钥
# （详见 operations/configuration-and-ops.md）
pnpm prisma migrate dev
pnpm prisma db seed          # 创建默认用户与示例数据（seed.ts）
pnpm dev                     # next dev --turbopack，默认 http://localhost:3000
```

> 注意：`pnpm dev` 会先在 `prisma/seed.ts` 中执行种子脚本；如果只想启动服务可以单独运行 `pnpm next dev --turbopack`。

## 源码地图（高层）

```
src/
├── app/                    # Next.js App Router（页面 + /api/* 路由）
│   ├── api/                # 后端：messages/comments/tags/templates/search/ai/ai-commands/...
│   ├── workspace/[id]/     # 按 Workspace 切换的页面
│   └── settings/           # AI 配置、AI 命令、Workspace 管理等
├── components/             # 客户端 UI 组件（InputMachine、CommentsList、PostDialog...）
├── lib/
│   ├── api/                # 前端调用的 API 客户端
│   ├── ai/                 # OpenAI / RAG / RAGFlow / 线程上下文 / 系统 Prompt
│   ├── prisma.ts           # PrismaClient 单例
│   ├── queue.ts            # addTask 队列
│   ├── storage.ts          # sessionStorage 封装（asr_api_key 等）
│   ├── stores/             # Zustand stores（workspace 等）
│   └── utils/              # ai-detection 等纯函数
├── types/                  # 共享 TS 类型（src/types/api.ts）
└── hooks/                  # use-toast、use-debounce 等
prisma/
├── schema.prisma           # 数据库 schema
├── migrations/             # Prisma 迁移
└── seed.ts                 # 默认数据
```

## 常见问题入口

| 我想知道… | 看哪里 |
| --- | --- |
| 项目是什么、怎么跑起来 | 本文 + `operations/configuration-and-ops.md` |
| 一个请求怎么从浏览器走到数据库 | `architecture/overview.md` |
| 表结构、字段、外键 | `architecture/data-model.md` |
| `@goldierill` 和 `@rag` 的区别 | `features/ai-and-rag.md` |
| 评论怎么排序、如何嵌套 | `features/posts-and-discussions.md` |
| Workspace 切换影响什么 | `features/workspaces-and-knowledge-sync.md` |
| 后台任务是怎么调度的 | `architecture/overview.md`（Background jobs 节） |

## 仍未覆盖（Backlog）

下列源码区域在本次初始化中尚未独立成页，但已在对应页面里被简要提及；后续可按需扩展：

- **Markdown 同步机制（`enableMdSync` / `mdSyncDir`）** — 详见 `features/workspaces-and-knowledge-sync.md`，但 `src/lib/md-sync/*` 的实现细节未单列页面。源锚点：`src/lib/md-sync/`、`src/app/api/ai/md-sync/route.ts`。
- **链接推荐（`enableLinkSuggestion`）** — 仅在 `src/app/api/ai/link-suggestion/route.ts` 与 AIConfig 模型中存在；本次未深入整理。源锚点：`src/app/api/ai/link-suggestion/route.ts`。
- **标签自动归类（`addTask("auto-tag-message"|"auto-tag-comment")`）** — 调用点在多处，具体处理器实现未在初始化阶段阅读。源锚点：`src/lib/queue.ts`、各调用方。
- **搜索后端（FTS5 / 向量混合）** — 仓库中提及 `search-message` 任务、`search` API，但未单独建页。源锚点：`src/app/api/search/route.ts`、`src/lib/queue.ts`。
- **测试体系** — 仓库未发现 `__tests__/`、`tests/`、`*.test.ts` 等文件；当前 init 假定没有自动化测试。
- **CI / 部署流水线** — 未发现 `.github/workflows/`、`Dockerfile` 等；本维基只覆盖本地开发与脚本。