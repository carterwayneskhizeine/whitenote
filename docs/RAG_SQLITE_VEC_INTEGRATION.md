# WhiteNote sqlite-vec RAG 集成方案

## 1. 背景与目标

### 现状

WhiteNote 当前使用 **RAGFlow** 作为 RAG 后端，通过 `src/lib/ai/ragflow.ts` 实现文档同步、向量检索和流式问答。RAGFlow 提供了完整的知识库管理能力，但存在以下局限：

- 依赖外部服务，部署和运维成本高
- 检索能力受限于 RAGFlow 内部实现，无法精细控制分块策略和搜索参数
- 网络延迟和不稳定性影响用户体验
- 缺少混合搜索（关键字 + 语义）能力

### 目标

引入 **sqlite-vec** 向量搜索扩展作为 WhiteNote 的默认 RAG 方案，RAGFlow 降级为备选：

- **sqlite-vec 优先**：内嵌于 SQLite 数据库，零部署、零运维，始终可用
- **RAGFlow 备选**：当 Workspace 已配置 RAGFlow 知识库且用户明确需要时，可切换到 RAGFlow
- **自主可控**：完全由 WhiteNote 控制分块策略、Embedding 模型、搜索参数
- **混合搜索**：支持关键字搜索、语义搜索、混合搜索三种模式
- **零外部依赖**：sqlite-vec 是 SQLite 扩展，无需 Docker、无需额外部署

### 为什么选 sqlite-vec 而不是 Qdrant

| 维度 | sqlite-vec | Qdrant |
|------|-----------|--------|
| 部署 | `pnpm install` 即用 | 需要 Docker 或 Cloud 服务 |
| 数据存储 | 同一个 SQLite 数据库 | 独立服务，独立存储 |
| 运维 | 零运维 | 需要监控、备份、升级 |
| 性能 | 万级文档场景足够 | 十万级以上更优 |
| 依赖 | 仅 npm 包 | Docker / 云服务 |

WhiteNote 是中小规模协作平台，万级文档范围内 sqlite-vec 完全满足需求。

### 参考

本方案移植自 HyperBoard 项目的 RAG 实现，并参考其 OOM 排查经验（详见第 9 节）：

| HyperBoard 文件 | 功能 | WhiteNote 对应 |
|----------------|------|---------------|
| `src/utils/rag-service.js` | 向量存储管理、索引、搜索 | `src/lib/ai/vec-store.ts` |
| `src/utils/embedding.js` | Embedding 生成 | `src/lib/ai/embedding.ts` |
| `src/utils/chunker.js` | 文本分块 | `src/lib/ai/chunker.ts` |
| `src/utils/ai-handler.js` | RAG 上下文构建 + LLM 问答 | `src/lib/ai/rag.ts` |
| `src/database/vec-migration.js` | 历史数据批量索引 | `src/app/api/ai/reindex/route.ts` |
| `src/routes/search.js` | 混合搜索 API | `src/app/api/ai/search/route.ts` |

---

## 2. 架构设计

### 2.1 整体架构

```
用户发帖 / 评论 / @goldierill 提问
         │
         ▼
┌─────────────────────┐
│  RAG Router (新增)   │  ← 默认 sqlite-vec，可选切换 RAGFlow
│  src/lib/ai/rag.ts   │
└────┬───────────┬─────┘
     │           │
     ▼           ▼
 sqlite-vec     RAGFlow
 (默认)        (备选)
     │           │
┌────┴─────┐     │
│ Embedding │     │  ← SiliconFlow / OpenAI 兼容 API
│ Chunker   │     │  ← 文本分块（含 OOM 防护）
│ SQLite DB │     │  ← 同一个 .db 文件，vec0 虚拟表
└────┬─────┘     │
     │           │
     ▼           ▼
   LLM 生成回答（OpenAI API）
```

### 2.2 RAG 路由策略

```typescript
// src/lib/ai/rag.ts
async function resolveRAGBackend(
  userId: string,
  workspaceId: string
): Promise<'ragflow' | 'sqlite-vec'> {
  const config = await getAiConfig(userId)

  // 1. 有 Embedding API Key → 使用 sqlite-vec（主路径）
  if (config.embeddingApiKey) return 'sqlite-vec'

  // 2. 无 Embedding Key → 尝试 RAGFlow（备选）
  const workspace = await getWorkspace(workspaceId)
  if (workspace.ragflowDatasetId && config.ragflowApiKey) {
    return 'ragflow'
  }

  // 3. 都没有 → 无法使用 RAG
  throw new Error('请配置 Embedding API Key 或 RAGFlow')
}
```

### 2.3 数据流

**索引流程（发帖/评论时）：**

```
内容创建 → Queue Job → RAG Router
                         ├→ sqlite-vec（默认）:
                         │    ├→ stripMentions()     清理 @提及
                         │    ├→ sampleText()        长文本采样
                         │    ├→ chunkText()         分块（含 OOM 防护）
                         │    ├→ generateEmbedding() 生成向量
                         │    └→ INSERT INTO vec_*   写入虚拟表
                         └→ RAGFlow（备选）: syncToRAGFlow()
```

**搜索流程（@goldierill 提问时）：**

```
用户提问 → RAG Router
            ├→ sqlite-vec（默认）:
            │    ├→ generateEmbedding(query)  查询向量化
            │    ├→ SELECT ... MATCH ?        向量检索 Top-K
            │    ├→ fetchFullContent()         拉取完整原文
            │    ├→ buildContext()             构建上下文
            │    └→ callOpenAIStream()         LLM 生成回答
            └→ RAGFlow（备选）: callRAGFlowStream()
```

---

## 3. 新增文件清单

```
src/lib/ai/
├── rag.ts              # RAG 路由器（判断使用哪个后端，含健康检查）
├── vec-store.ts        # sqlite-vec 向量存储（建表、索引、搜索）
├── embedding.ts        # Embedding 生成（SiliconFlow / OpenAI 兼容）
└── chunker.ts          # 文本分块逻辑（含 OOM 防护）

src/app/api/
├── ai/search/
│   └── route.ts        # 混合搜索 API（GET /api/ai/search?q=xxx&mode=hybrid）
└── ai/reindex/
    └── route.ts        # 手动触发全量重建索引（POST /api/ai/reindex）
```

---

## 4. 详细设计

### 4.1 数据库 Schema 变更

在 `AiConfig` 模型中新增 Embedding 配置字段（无需 Qdrant 连接字段）：

```prisma
model AiConfig {
  // ... 现有字段 ...

  // Embedding 配置（sqlite-vec 模式使用）
  embeddingBaseUrl     String    @default("https://api.siliconflow.cn/v1")
  embeddingApiKey      String    @default("")
  embeddingModel       String    @default("Qwen/Qwen3-Embedding-4B")
}
```

**sqlite-vec 虚拟表（由代码自动创建，不经过 Prisma）：**

```sql
-- 每个 Workspace 一个虚拟表（在 WhiteNote 主数据库中）
CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks_{workspaceId} USING vec0(
  id INTEGER PRIMARY KEY,
  source_type TEXT,
  source_id   TEXT,
  chunk_index INTEGER,
  chunk_text  TEXT,
  embedding   float[2560]
);
```

**使用 `better-sqlite3` + `sqlite-vec` 扩展操作虚拟表，不走 Prisma。**

### 4.2 文本分块器 — `src/lib/ai/chunker.ts`

移植 HyperBoard 的 `chunker.js`，改为 TypeScript，**内置 OOM 防护**：

```typescript
interface ChunkOptions {
  chunkSize?: number    // 默认 500
  overlap?: number      // 默认 50
}

function chunkText(text: string, options?: ChunkOptions): string[]
```

**核心逻辑：**
- 按 `chunkSize`（默认 500 字符）分块
- 块之间 `overlap`（默认 50 字符）重叠，保留上下文
- 优先在句子边界断开（`。！？\n\r！？.!?.`）

**OOM 防护（HyperBoard 血泪教训）：**

```typescript
// 关键：必须记录 prevStart，防止回退导致无限循环
export function chunkText(text: string, options?: ChunkOptions): string[] {
  const chunkSize = options?.chunkSize ?? 500
  const overlap = options?.overlap ?? 50
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)

    // 在 chunkSize 范围内找最近的句子边界
    if (end < text.length) {
      const boundaryChars = '。！？\n\r！?.! '
      for (let i = end; i > start + chunkSize * 0.5; i--) {
        if (boundaryChars.includes(text[i])) {
          end = i + 1
          break
        }
      }
    }

    chunks.push(text.slice(start, end))

    // ★ OOM 防护：到达文本末尾时必须退出
    if (end >= text.length) break

    // ★ OOM 防护：start 必须严格前进，否则 break
    const prevStart = start
    start = end - overlap
    if (start <= prevStart) break  // 防止无限循环
  }

  return chunks
}
```

### 4.3 Embedding 生成 — `src/lib/ai/embedding.ts`

```typescript
interface EmbeddingConfig {
  apiUrl: string
  apiKey: string
  model: string
  dimension: number
}

async function generateEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<number[]>

async function generateEmbeddings(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]>
```

**核心逻辑：**
- 支持 SiliconFlow API（默认）和 OpenAI 兼容接口
- 单条文本截断到 2000 字符
- 批量接口减少 API 调用次数
- 错误重试（最多 3 次，指数退避）
- **API 响应体限制 2MB**（防止异常响应导致 OOM）

### 4.4 向量存储 — `src/lib/ai/vec-store.ts`

使用 `better-sqlite3` 加载 `sqlite-vec` 扩展，操作虚拟表：

```typescript
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'

// 单例数据库连接（与 Prisma 共享同一个 .db 文件）
let vecDb: Database | null = null

function getVecDb(): Database {
  if (!vecDb) {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    vecDb = new Database(dbPath, { readonly: false })
    sqliteVec.load(vecDb)
    // 启用 WAL 模式，避免与 Prisma 锁冲突
    vecDb.pragma('journal_mode = WAL')
  }
  return vecDb
}

// 向量 Chunk 记录
interface VecChunk {
  id: number
  sourceType: 'message' | 'comment'
  sourceId: string
  chunkIndex: number
  chunkText: string
  embedding: Float32Array
}

// 核心函数
async function ensureVecTable(
  workspaceId: string,
  dimension: number
): Promise<void>

async function indexContent(params: {
  workspaceId: string
  sourceType: 'message' | 'comment'
  sourceId: string
  text: string
  embeddingConfig: EmbeddingConfig
}): Promise<void>

async function removeContent(params: {
  workspaceId: string
  sourceType: 'message' | 'comment'
  sourceId: string
}): Promise<void>

async function search(params: {
  workspaceId: string
  queryVector: Float32Array
  topK: number
}): Promise<Array<{ sourceType: string; sourceId: string; score: number }>>
```

**虚拟表命名规则：**

- 每个 Workspace 一个虚拟表：`vec_chunks_{workspaceId}`
- 向后兼容（无 workspaceId）：`vec_chunks_default`
- 表不存在时自动创建（`ensureVecTable`）

**搜索查询：**

```sql
SELECT source_type, source_id, distance
FROM vec_chunks_{workspaceId}
WHERE embedding MATCH ?
ORDER BY distance
LIMIT ?
```

**注意事项：**
- `better-sqlite3` 与 Prisma 共享同一个 SQLite 文件，使用 WAL 模式避免锁冲突
- 向量写入使用 `Float32Array`，由 `sqlite-vec` 直接处理
- 虚拟表不由 Prisma 管理，生命周期由代码控制

### 4.5 RAG 路由器 — `src/lib/ai/rag.ts`

```typescript
type RAGBackend = 'ragflow' | 'sqlite-vec'

interface RAGContext {
  backend: RAGBackend
  context: string
  sources: Array<{ sourceType: string; sourceId: string; score: number }>
}

// 获取当前可用的 RAG 后端
async function resolveRAGBackend(
  userId: string,
  workspaceId: string
): Promise<RAGBackend>

// 统一的 RAG 检索接口
async function retrieveContext(params: {
  query: string
  userId: string
  workspaceId: string
  topK?: number
}): Promise<RAGContext>

// 统一的索引接口
async function indexContent(params: {
  sourceType: 'message' | 'comment'
  sourceId: string
  text: string
  userId: string
  workspaceId: string
}): Promise<void>

// 统一的删除接口
async function removeContent(params: {
  sourceType: 'message' | 'comment'
  sourceId: string
  userId: string
  workspaceId: string
}): Promise<void>
```

**路由逻辑：**

```
resolveRAGBackend()
  ├→ 默认返回 'sqlite-vec'（始终可用，无需外部服务）
  ├→ 如果 Workspace 配置了 ragflowDatasetId 且 AiConfig 有 ragflowApiKey
  │   ├→ 健康检查 RAGFlow（缓存结果 60s）
  │   ├→ RAGFlow 可用 → 返回 'ragflow'（备选）
  │   └→ RAGFlow 不可用 → 回退到 'sqlite-vec'
  └→ 未配置 RAGFlow → 'sqlite-vec'
```

### 4.6 混合搜索 API — `src/app/api/ai/search/route.ts`

```
GET /api/ai/search?q=xxx&mode=hybrid&workspaceId=xxx&page=1&limit=20
```

**搜索模式：**

| mode | 说明 |
|------|------|
| `keyword` | Prisma `contains` 查询，仅关键字匹配 |
| `semantic` | sqlite-vec 向量相似度搜索 |
| `hybrid` | 合并关键字 + 语义结果，去重排序（默认） |

**hybrid 模式合并策略：**
1. 并行执行关键字搜索和语义搜索
2. 语义搜索结果按 distance score 排序
3. 关键字搜索结果排在语义结果之后
4. 按 sourceId 去重
5. 从数据库拉取完整内容返回

### 4.7 AI 问答集成

修改现有 `src/app/api/ai/chat/route.ts` 和 `stream/route.ts`：

```typescript
// 现有逻辑：
// mode === 'ragflow' → callRAGFlowStream()

// 新增逻辑：
// mode === 'ragflow' → {
//   if (resolveRAGBackend() === 'sqlite-vec') → vecRAGChat()  // 默认路径
//   else → callRAGFlowStream()  // RAGFlow 备选
// }
```

**sqlite-vec 模式的 AI 问答流程：**

```typescript
async function vecRAGChat(params: {
  query: string
  userId: string
  workspaceId: string
  personality: string
  expertise: string
}): AsyncGenerator<string> {

  // 1. 检索相关内容
  const { context, sources } = await retrieveContext(params)

  // 2. 构建 System Prompt
  const systemPrompt = buildRAGSystemPrompt(params.personality, params.expertise)

  // 3. 调用 OpenAI 流式生成
  const stream = callOpenAIStream({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `以下是从历史消息中检索到的相关内容：\n${context}` },
      { role: 'user', content: params.query }
    ]
  })

  return stream
}
```

**System Prompt 模板：**

```
你是 {personality} 风格的 AI 助手，擅长 {expertise} 领域。
请根据提供的历史消息上下文回答用户问题。
如果上下文中没有相关信息，请诚实说明，不要编造。
回答使用中文。
```

---

## 5. 索引策略

### 5.0 AI 评论排除规则

**AI 生成的评论（`isAIBot: true`）不得被索引到任何 RAG 后端**（RAGFlow 和 sqlite-vec）。

原因：
- AI 评论是对已有内容的总结或回答，索引它们会导致 RAG 检索时返回"AI 说过的内容"而非用户原创内容
- AI 回答可能包含幻觉或错误，不应作为知识库的可靠来源
- 避免自我引用循环：AI 检索到自己的旧回答后基于它继续生成

**实施位置：**
- `sync-rag` 队列处理器：评论类型时检查 `isAIBot` 字段，为 true 则跳过
- `delete-rag` 队列处理器：无需过滤（删除操作是安全的）
- 全量 reindex API（`POST /api/ai/reindex`）：查询评论时加 `where: { isAIBot: false }`
- 现有 `sync-ragflow` 处理器也需加上此过滤（向后兼容）

### 5.1 内容采样

移植 HyperBoard 的采样策略（已修复长文本丢失问题），适配 WhiteNote 的富文本内容：

```typescript
function sampleText(htmlContent: string, maxLength = 2000): string {
  // 1. 移除 HTML 标签，保留纯文本
  const text = stripHtml(htmlContent)

  // 2. 移除 @提及（如 @goldierill）
  const cleaned = stripMentions(text)

  // 3. 短文本直接返回
  if (cleaned.length <= maxLength) return cleaned

  // 4. 长文本采样：前 1000 + 后 1000 字符
  //    （HyperBoard 教训：只取前 N 字符会丢失末尾关键数据，如八字报告）
  const half = maxLength / 2
  return cleaned.slice(0, half) + '\n...\n' + cleaned.slice(-half)
}
```

### 5.2 索引时机

通过现有队列系统 (`src/lib/queue/simple.ts`) 添加新 Job：

| Job 名称 | 触发时机 | 处理逻辑 |
|----------|---------|---------|
| `sync-rag` | 消息/评论创建、更新 | 统一通过 `rag.indexContent()` 同步到 sqlite-vec（默认）或 RAGFlow（备选） |
| `delete-rag` | 消息/评论删除 | 统一通过 `rag.removeContent()` 从 sqlite-vec 或 RAGFlow 删除 |

**修改队列注册：**

```typescript
// 现有
registerHandler('sync-ragflow', async (job) => { ... })

// 改为
registerHandler('sync-rag', async (job) => {
  const { sourceType, sourceId, text, userId, workspaceId } = job.data
  await ragIndexContent({ sourceType, sourceId, text, userId, workspaceId })
})
```

### 5.3 历史数据迁移

新增 `POST /api/ai/reindex` API，用于全量重建索引：

```typescript
// src/app/api/ai/reindex/route.ts
POST /api/ai/reindex
Body: { workspaceId?: string, dryRun?: boolean }

// 流程：
// 1. 查询所有公开消息和评论
// 2. 逐条调用 indexContent()，间隔 2 秒避免 API 限流
// 3. 每处理 50 条记录输出内存使用日志
// 4. 返回进度和统计信息
```

---

## 6. 依赖项

### 6.1 NPM 包

```json
{
  "sqlite-vec": "^0.1.6",
  "better-sqlite3": "^11.0.0",
  "@types/better-sqlite3": "^7.6.0"
}
```

| 包 | 用途 |
|---|------|
| `sqlite-vec` | SQLite 向量搜索扩展（纯 WASM，无需编译） |
| `better-sqlite3` | 同步 SQLite 驱动，用于操作虚拟表 |

### 6.2 外部服务

| 服务 | 用途 | 必须 | 配置方式 |
|------|------|------|---------|
| SQLite + sqlite-vec | 向量数据库 | 始终可用（内嵌） | 自动，无需配置 |
| SiliconFlow API | Embedding 生成 | 是（sqlite-vec 模式时） | `.env` |
| OpenAI API | LLM 生成 | 已有 | 已配置 |

**与 Qdrant 方案对比：少了一个 Docker 服务，少了一个运维负担。**

### 6.3 Embedding 配置（数据库存储）

Embedding 相关配置存储在数据库 `AiConfig` 模型中，通过网页 AI 设置页面配置，**不需要在 `.env` 中设置**：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `embeddingBaseUrl` | `https://api.siliconflow.cn/v1` | Embedding API 地址（OpenAI 兼容） |
| `embeddingApiKey` | 空 | API Key（填写后启用 sqlite-vec RAG） |
| `embeddingModel` | `Qwen/Qwen3-Embedding-4B` | Embedding 模型名称 |

配置路径：网页 → AI 设置 → Embedding 配置区块。

**注意：没有 `QDRANT_URL`、没有 `QDRANT_API_KEY`、没有 Docker 配置。** sqlite-vec 自动使用 WhiteNote 现有的 SQLite 数据库。

---

## 7. 实施计划

### Phase 1：基础设施（第 1-2 天）

- [ ] 安装 `sqlite-vec`、`better-sqlite3` 依赖
- [ ] 新增 `src/lib/ai/chunker.ts` — 移植分块逻辑（含 OOM 防护）
- [ ] 新增 `src/lib/ai/embedding.ts` — 移植 Embedding 生成
- [ ] 新增 `src/lib/ai/vec-store.ts` — sqlite-vec 连接管理、虚拟表 CRUD
- [ ] 修改 `prisma/schema.prisma` — AiConfig 新增字段
- [ ] 运行 `pnpm prisma db push` 同步 schema

### Phase 2：RAG 路由与集成（第 3 天）

- [ ] 新增 `src/lib/ai/rag.ts` — RAG 路由器
- [ ] 实现健康检查和自动降级逻辑
- [ ] 修改 `src/app/api/ai/chat/route.ts` — 集成 sqlite-vec 问答
- [ ] 修改 `src/app/api/ai/chat/stream/route.ts` — 集成 sqlite-vec 流式问答
- [ ] 修改队列 Job 注册 — `sync-ragflow` → `sync-rag`

### Phase 3：搜索 API（第 4 天）

- [ ] 新增 `src/app/api/ai/search/route.ts` — 混合搜索 API
- [ ] 新增 `POST /api/ai/reindex` — 全量重建索引
- [ ] 前端搜索组件接入混合搜索 API（`RightSidebar.tsx`）

### Phase 4：测试与优化（第 5 天）

- [ ] 手动测试 sqlite-vec 主路径正常工作
- [ ] 手动测试 RAGFlow 备选路径和降级回退
- [ ] 测试混合搜索三种模式
- [ ] 测试历史数据全量索引
- [ ] 内存使用监控和 OOM 压力测试
- [ ] 性能调优（分块大小、Top-K、超时）

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Embedding API 限流 | 索引延迟增加 | 队列异步处理 + 2s 间隔 + 批量接口 |
| `better-sqlite3` 与 Prisma 锁冲突 | 写入失败 | WAL 模式 + 重试逻辑 |
| 虚拟表损坏 | 搜索失败 | 提供 `/api/ai/reindex` 全量重建 |
| RAGFlow 连接不稳定 | 频繁切换后端 | RAGFlow 是备选，主路径 sqlite-vec 不受影响；健康检查结果缓存 60s |
| 历史数据量大 | 全量索引耗时长 | 分批处理 + 进度汇报 + 2s 限流 |
| 向量维度变更 | 已有索引失效 | 维度变更时自动重建索引 |

---

## 9. OOM 防护（基于 HyperBoard 排查经验）

> 本节基于 `D:\Code\HyperBoard\docs\oom-debug.md` 的实际生产故障排查经验。

### 9.1 根因：chunkText() 无限循环

HyperBoard 在生产环境中遭遇过 Node.js OOM 崩溃。根本原因是 `chunkText()` 函数在特定文本长度下（500-600 字符区间，或最后一块比 overlap 短时），`start` 指针回退到与上一次相同的位置，导致 `while` 循环永不退出，`chunks` 数组无限增长直到堆内存耗尽。

**内存飙升轨迹（HyperBoard 生产日志）：**

```
[RAG-MEM] index-message-9-start: heap=14.7MB / 21.1MB
[RAG-MEM] after-remove: heap=15.0MB / 21.1MB
[RAG-MEM] after-sample len=1063: heap=15.0MB / 21.1MB
FATAL ERROR: heap out of memory   ← chunkText() 在此处进入无限循环
```

从 15MB 瞬间飙升至 768MB 上限，全部被无限增长的 `chunks` 数组占用。

### 9.2 防护措施

WhiteNote 的 `chunker.ts` 必须包含以下防护：

```typescript
// ★ 防护一：到达文本末尾必须退出
if (end >= text.length) break

// ★ 防护二：start 必须严格前进
const prevStart = start
start = end - overlap
if (start <= prevStart) break
```

**禁止使用以下写法（HyperBoard 旧版 bug）：**

```typescript
// ❌ 错误：在特定文本长度下 start 会回退
start = end - overlap
if (start <= (chunks.length > 1 ? end - chunkSize + overlap : 0)) {
  start = end
}
```

### 9.3 其他内存防护

基于 HyperBoard 的排查经验，额外注意事项：

| 问题 | HyperBoard 教训 | WhiteNote 防护 |
|------|----------------|---------------|
| 文本采样过短 | 只取前 2000 字符，丢失末尾关键数据 | 改为前后各取 1000 字符的 `sampleText()` |
| API 响应无限制 | axios 无 `maxContentLength`，异常大响应导致 OOM | Embedding API 响应体限制 2MB |
| RAG 上下文过小 | top 3 + 1500 字符截断，AI 看不到足够内容 | top 5 + 4000 字符 + `fetchFullContent()` |
| 批量索引无间隔 | 连续调用 Embedding API 导致内存堆积 | 每条间隔 2 秒，每 50 条记录日志内存 |

### 9.4 内存监控

在索引和搜索关键节点插入内存日志（生产环境可通过 LOG_LEVEL=debug 开启）：

```typescript
function logMemory(label: string) {
  if (process.env.LOG_LEVEL !== 'debug') return
  const mem = process.memoryUsage()
  console.log(`[RAG-MEM] ${label}: heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`)
}
```

---

## 10. API 接口汇总

### 新增接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/ai/search?q=xxx&mode=hybrid&workspaceId=xxx` | 混合搜索 |
| `POST` | `/api/ai/reindex` | 全量重建索引 |

### 修改接口

| 方法 | 路径 | 变更说明 |
|------|------|---------|
| `POST` | `/api/ai/chat` | 默认使用 sqlite-vec，RAGFlow 作为备选 |
| `POST` | `/api/ai/chat/stream` | 默认使用 sqlite-vec，RAGFlow 作为备选 |

### 对外行为不变

- `@goldierill` 触发逻辑不变
- `@ragflow` 触发逻辑改为 `@rag`（去掉 flow，统一语义：sqlite-vec 和 RAGFlow 均由 `@rag` 触发，内部自动路由）
- RAGFlow 配置和同步机制不变
- 现有消息/评论 API 不变

---

## 11. 配置检查清单

上线前确认以下配置：

- [ ] `pnpm install` 完成（sqlite-vec、better-sqlite3 已安装）
- [ ] Embedding API Key 已配置（网页 AI 设置 → Embedding 配置）
- [ ] 数据库 AiConfig 中 Embedding 相关字段已填写
- [ ] `pnpm prisma db push` 已执行，AiConfig schema 已同步
- [ ] 应用启动后虚拟表自动创建（首次访问时）
- [ ] 历史数据已执行全量索引（`POST /api/ai/reindex`）
- [ ] sqlite-vec 主路径工作正常（`@goldierill` 提问测试）
- [ ] RAGFlow 备选路径可用（如已配置）
