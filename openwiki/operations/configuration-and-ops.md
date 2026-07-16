# 运行与运维

本文汇总本地开发、数据库初始化、环境变量、脚本与常见故障排查。建议先看一遍 `quickstart.md`，再按需回到本文。

## 环境要求

- Node.js 20+（Next.js 15 / React 19 的最低要求；具体版本以 `.nvmrc` / CI 配置为准）。
- pnpm（推荐，仓库已带 `pnpm-lock.yaml`）；若使用 npm / yarn，请自行承担 lockfile 漂移风险。
- SQLite（Prisma 自带 `better-sqlite3` / `@prisma/client`，无需独立进程）。
- 可选：本地 RAGFlow 实例（仅当你需要 `@rag` 回退路径）。

## 环境变量

> 不要把真实密钥提交进仓库；下表只描述变量用途与格式。`.env` / `.env.local` 由开发者自行维护。

| 变量 | 必填 | 用途 | 备注 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | Prisma 数据源 | 默认 `file:./dev.db`（见 `prisma/schema.prisma`） |
| `NEXTAUTH_SECRET` | 是 | NextAuth JWT 签名 | 任意长随机字符串 |
| `NEXTAUTH_URL` | 否 | NextAuth 回调地址 | 本地默认 `http://localhost:3000` |
| `OPENAI_BASE_URL` | 否 | OpenAI 兼容服务地址 | 也可在 `AIConfig` 里覆盖 |
| `OPENAI_API_KEY` | 否 | OpenAI 兼容服务 Key | 也可在 `AIConfig` 里覆盖 |
| `EMBEDDING_BASE_URL` | 否 | Embedding 服务地址 | 启用 sqlite-vec RAG 时需要 |
| `EMBEDDING_API_KEY` | 否 | Embedding 服务 Key | 同上 |
| `RAGFLOW_BASE_URL` | 否 | RAGFlow 地址 | 回退路径使用 |
| `RAGFLOW_API_KEY` | 否 | RAGFlow API Key | 同上 |
| `ASR_API_KEY` | 否 | SiliconFlow ASR Key | 浏览器侧也会从 `sessionStorage` 读取 |

`AIConfig` 模型是运行时覆盖：环境变量用于「冷启动默认值」，用户在 `设置 → AI 配置` 里保存的值会写入数据库并优先使用。

## 数据库初始化

```bash
pnpm prisma migrate dev      # 应用所有迁移并生成 Prisma Client
pnpm prisma generate         # 仅当上面未自动生成
pnpm prisma db seed          # 写入默认用户 / Workspace / 示例消息
```

- 迁移文件位于 `prisma/migrations/`；每次改动 schema 后使用 `pnpm prisma migrate dev --name <描述>`。
- 种子文件：`prisma/seed.ts`。失败时通常是 `DATABASE_URL` 不存在或权限不足。
- 重置：`pnpm prisma migrate reset`（会清空数据库并重新 seed，仅限开发）。

## 常用脚本（来自 `package.json`）

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | `next dev --turbopack`，开发服务器 + 触发 seed |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务 |
| `pnpm lint` | ESLint（仓库自带 `eslint.config.mjs`） |
| `pnpm prisma studio` | 打开 Prisma Studio 浏览数据 |

> `pnpm dev` 会先调用 `prisma db seed`；如果只想启动而不 seed，可改用 `pnpm next dev --turbopack`。

## 开发流程建议

1. **小步迁移**：schema 变更用 `pnpm prisma migrate dev` 而非 `db push`，避免历史丢失。
2. **前端 API 客户端**改动后，记得同步 `src/types/api.ts` 的类型；组件多数用 `data?.error` 分支处理错误。
3. **AI 字段**：先在 `AIConfig` 表里写入默认 Key，再调试 `getAiConfig` 的返回；线上环境不要把密钥打印到日志。
4. **后台任务**：调试时可以在 `src/lib/queue.ts` 临时打印 `addTask` 入参；上线前移除。
5. **RAG 行为**改动：本地清空 `MessageEmbedding` 后重新触发几条 `process-message`，验证检索质量。

## 部署注意

- SQLite 文件需要随部署一起持久化（或迁移到 Postgres，schema 中多数字段通用）。
- 任何使用 `prisma db seed` 的部署流程会在生产库写入示例数据，应当禁用或替换为受控的初始数据导入。
- 默认监听 Node.js runtime（见 `route.ts` 中的 `export const runtime = 'nodejs'`），Edge runtime 不被使用。
- ASR 直连 SiliconFlow 的逻辑在浏览器侧，注意跨域与速率限制。

## 常见故障排查

| 症状 | 可能原因 | 处理 |
| --- | --- | --- |
| 启动报 `PrismaClientInitializationError` | `DATABASE_URL` 缺失 / 数据库文件无写权限 | 检查 `.env`、`ls -l dev.db`、重新 `migrate dev` |
| NextAuth 一直回到登录页 | `NEXTAUTH_SECRET` 变化或 `NEXTAUTH_URL` 不匹配 | 清浏览器 cookie，重新设置环境变量 |
| `@goldierill` 触发后无回复 | OpenAI Key 未配置 / base URL 不可达 | 检查 `AIConfig` 中的 `openaiBaseUrl/openaiApiKey`，或 `src/lib/ai/openai.ts` 的日志 |
| `@rag` 报错「Workspace RAGFlow not configured」 | Workspace 缺少 `ragflowChatId` 且无 Embedding | 绑定 RAGFlow 或配置 Embedding（见 `features/ai-and-rag.md`） |
| `@rag` 报错「RAGFlow 调用失败」 | RAGFlow 配置错误或网络问题 | 检查 `AIConfig.ragflowBaseUrl/ragflowApiKey`、Workspace 关联 |
| 录音没有转写 | 浏览器不支持 `MediaRecorder`、ASR Key 缺失 | 检查 `sessionStorage.asr_api_key` 或 `AIConfig.asrApiKey`；换 Chrome 测试 |
| 自动打标没生效 | `Workspace.enableAutoTag=false` 或 `autoTagModel` 未填 | 在 `设置 → Workspace` 打开开关；填好模型名 |
| 后台任务没有跑 | 队列 worker 未启动 / 进程被回收 | 检查 `src/lib/queue.ts` 的启动入口；本地重启 dev server |

## 安全与隐私

- 真实密钥只放在 `.env*` / `AIConfig`（数据库）中；浏览器侧只有 ASR Key 会进入 `sessionStorage`。
- `.env*` 已默认被 gitignore；如有例外，请在提交前确认仓库 `.gitignore`。
- OpenAI / Embedding / RAGFlow 请求都会带用户内容，部署时请确认这些服务的隐私策略与数据保留条款。

## 进一步阅读

- `quickstart.md` — 30 秒上手。
- `architecture/overview.md` — 架构、请求生命周期、后台任务。
- `architecture/data-model.md` — Prisma schema。
- `features/ai-and-rag.md` — AI 行为细节。
- `features/workspaces-and-knowledge-sync.md` — Workspace / RAG / Markdown 同步。