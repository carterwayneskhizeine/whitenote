# sqlite-vec 生产模式加载失败问题

## 问题描述

生产模式（`pnpm start`）下，`sync-rag` 后台任务失败，错误信息：

```
[Queue] Job failed: sync-rag TypeError: y.resolve is not a function
    at N (src\lib\ai\vec-store.ts:55:14)

[Queue] Job failed: sync-rag SqliteError: no such module: vec0
    at N (src\lib\ai\vec-store.ts:59:6)
```

开发模式（`pnpm dev`）下无此问题。

## 环境信息

- 平台：`win32 x64`
- Node.js：`v22.22.0`
- `better-sqlite3`：`12.9.0`
- `sqlite-vec`：`0.1.9`
- `sqlite-vec-windows-x64`：`0.1.9`
- 部署方式：`output: 'standalone'`（`next.config.ts` 生产模式启用）

## 相关代码

### `src/lib/ai/vec-store.ts`（问题出在这）

```typescript
import BetterSqlite3 from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import path from 'path'

let vecDb: Database | null = null

function getVecDb(): Database {
  if (vecDb) return vecDb

  const dbPath = path.join(process.cwd(), 'data', 'whitenote.db')
  vecDb = new BetterSqlite3(dbPath, { readonly: false })
  vecDb.pragma('journal_mode = WAL')
  sqliteVec.load(vecDb)   // <-- 第 30 行，在生产模式下失败

  dbPath.exec(`CREATE TABLE IF NOT EXISTS vec_rowid_seq...`)
  return vecDb
}
```

`sqliteVec.load(db)` 调用 `db.loadExtension(getLoadablePath())`，在独立进程中直接测试时成功，但在 standalone bundle 中失败。

### `src/lib/queue/worker.ts`（注册 worker）

```typescript
import { registerHandler } from "./simple"
import { processSyncRAG } from "./processors/sync-rag"
import { processSyncRAGFlow } from "./processors/sync-ragflow"
import { processAutoTag } from "./processors/auto-tag"
import { processAutoTagExtended } from "./processors/auto-tag-extended"
import { processSyncToLocal } from "./processors/sync-to-local"
import { processCreateWorkspaceFromFolder } from "./processors/create-workspace-from-folder"
import { processCreateMessageFromFile } from "./processors/create-message-from-file"

export function startWorker() {
  registerHandler("sync-rag", (data) => processSyncRAG({ data } as any))
  registerHandler("auto-tag", (data) => processAutoTag({ data } as any))
  // ... 其他 handler
  console.log("[Worker] In-process queue worker started")
}
```

### 触发路径

```
POST /api/sync/import-all
  → importAllFromLocal()
    → enqueue("sync-rag", { ... })
      → processSyncRAG()  // src/lib/queue/processors/sync-rag.ts
        → syncToRAG()
          → syncToSqliteVec()
            → ensureVecTable()  // src/lib/ai/vec-store.ts:54
```

## 独立测试（均成功）

以下测试在命令行直接执行均成功：

```bash
# 1. 模块加载
node -e "require('sqlite-vec'); console.log('OK')"

# 2. load() 调用
node -e "
const sqliteVec = require('sqlite-vec');
const BetterSqlite3 = require('better-sqlite3');
const db = new BetterSqlite3(':memory:');
sqliteVec.load(db);
console.log('load OK');
"

# 3. vec0 虚拟表创建
node -e "
const sqliteVec = require('sqlite-vec');
const BetterSqlite3 = require('better-sqlite3');
const db = new BetterSqlite3('D:/Code/whitenote/data/whitenote.db', { readonly: false });
sqliteVec.load(db);
db.exec(\"CREATE VIRTUAL TABLE IF NOT EXISTS test_vec USING vec0(embedding float[4])\");
console.log('vec table OK');
"
```

## 可能的根因

1. **`output: 'standalone'` 模式下 native addon 加载问题**
   - Next.js 的 standalone bundle 不会打包 `.node` native addon
   - `better-sqlite3` 本身可能通过 pre-gyp 二进制侥幸工作，但 `sqlite-vec` 的 `loadExtension()` 调用路径在 bundle 中可能指向错误位置

2. **`loadExtension` 方法在 bundle 中被替换**
   - standalone bundler 可能将 `BetterSqlite3.Database` 的实例方法 `loadExtension` 替换/移除，导致调用失败

3. **ESM/CJS 兼容问题**
   - `sqlite-vec` 是纯 ESM 包，通过 `.pnpm` 链接到 CJS 可用
   - 某些 bundler 转换可能影响模块的初始化顺序

## 当前临时方案

切换到开发模式运行：

```bash
pnpm build && pnpm dev
```

## 修复方向（供其他人参考）

1. **检查 standalone bundle 中 `db.loadExtension` 是否可用**
   - 在 `vec-store.ts` 的 `getVecDb()` 中添加检查：
     ```typescript
     console.log('[VecStore] loadExtension type:', typeof db.loadExtension)
     console.log('[VecStore] db path:', dbPath)
     console.log('[VecStore] vecDb instance:', db.constructor.name)
     ```

2. **尝试延迟加载 sqlite-vec**
   - 在 `sync-rag.ts` 的 `processSyncRAG` 函数内部动态 import：
     ```typescript
     const { ensureVecTable, storeChunks } = await import('@/lib/ai/vec-store')
     ```

3. **检查 standalone 输出的 node_modules**
   - 看看 `standalone/node_modules/better-sqlite3/` 和 `standalone/node_modules/sqlite-vec/` 是否正确
   - 验证 `sqlite-vec-windows-x64` 的 `.dll` 文件是否被复制

4. **考虑将 worker 分离为独立进程**
   - 当前 queue 是 in-process 的，可以改为独立的 `worker.ts` 进程
   - 独立进程不受 Next.js bundler 影响

5. **检查是否有环境变量控制 addon 加载路径**
   - `sqlite-vec` 的 `getLoadablePath()` 依赖 `require.resolve`
   - 在 standalone 中可能需要设置 `__dirname` polyfill

## 相关文件

| 文件 | 作用 |
|------|------|
| `src/lib/ai/vec-store.ts` | sqlite-vec 封装，`getVecDb()` 初始化向量存储 |
| `src/lib/ai/rag.ts` | RAG 路由，根据配置选择 sqlite-vec 或 RAGFlow |
| `src/lib/queue/processors/sync-rag.ts` | sync-rag 队列处理器 |
| `src/lib/queue/worker.ts` | 队列 worker 注册 |
| `src/lib/queue/simple.ts` | in-process 队列实现 |
| `next.config.ts` | 生产模式启用 `output: 'standalone'` |