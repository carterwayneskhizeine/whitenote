# 📋 文件同步系统简化方案

## 🔍 当前问题分析

### 1. 复杂度来源

当前系统涉及 **18 个核心文件**，主要复杂度来自：

| 问题 | 描述 |
|------|------|
| **过度分离的队列任务** | `create-workspace-from-folder` → `create-message-from-file` → `auto-tag` → `sync-ragflow` → `sync-to-local` 形成了 5 步链式调用 |
| **双向同步的元数据膨胀** | `workspace.json` 需要同时追踪 `originalFilename`、`currentFilename`、`commentFolderName` 等多个字段 |
| **重复的目录扫描逻辑** | `file-watcher`、`sync-utils`、`create-message-from-file` 都有各自的目录查找逻辑 |
| **V1→V2 迁移包袱** | `sync-utils.ts` 保留了大量 V1 兼容代码 |

### 2. 当前数据流图

```
文件系统 ─────> file-watcher ─────> BullMQ Queue ─────> Worker
                   │                      │
                   ▼                      ▼
            processedFiles Set    create-workspace-from-folder
            processedFolders Set          │
                                          ▼
                                  create-message-from-file
                                          │
                                     ┌────┴────┐
                                     ▼         ▼
                                 auto-tag   sync-ragflow
                                     │
                                     ▼
                                 sync-ragflow
                                     │
                                     ▼
                              exportToLocal (可选)
```

---

## 💡 简化方案

### 核心思路：**单向数据源 + 合并任务 + 简化元数据**

---

### 方案 A：删除双向同步（推荐）

> **原则**：选择一个**单一数据源**，要么文件系统是主，要么数据库是主

#### 选项 A1：文件系统为主（适合 Obsidian 用户）

```
文件系统 (link_md/) ─────> 数据库 ─────> RAGFlow
        主                  从              从
```

**删除的功能：**
- `sync-to-local` 任务
- `exportToLocal()` 函数
- `/api/sync/export-all` API

**简化后流程：**
```
.md 文件变化 → file-watcher → create-or-update-message → sync-ragflow
```

#### 选项 A2：数据库为主（适合 Web 优先用户）

```
数据库 ─────> 文件系统 (link_md/) ─────> RAGFlow
  主              只读镜像               从
```

**删除的功能：**
- `file-watcher` 系统
- `create-workspace-from-folder` 任务
- `create-message-from-file` 任务

**简化后流程：**
```
Web UI 操作 → 数据库 → sync-to-local → sync-ragflow
```

---

### 方案 B：合并队列任务

如果必须保留双向同步，至少可以合并任务：

#### 当前任务结构
```typescript
// 7 种任务类型
type JobType =
  | "auto-tag"
  | "auto-tag-comment"
  | "sync-ragflow"
  | "daily-briefing"
  | "sync-to-local"
  | "create-workspace-from-folder"
  | "create-message-from-file"
```

#### 简化后任务结构
```typescript
// 4 种任务类型
type JobType =
  | "sync-from-file"     // 合并 create-workspace + create-message + auto-tag + sync-ragflow
  | "sync-to-file"       // 保留 sync-to-local
  | "daily-briefing"     // 保留
  | "auto-tag-comment"   // 保留（Comment 场景特殊）
```

#### 合并后的 `sync-from-file` 处理器

```typescript
// src/lib/queue/processors/sync-from-file.ts
export async function processSyncFromFile(job: Job) {
  const { filePath, workspaceId } = job.data

  // 1. 确保 Workspace 存在（inline 处理，不再单独任务）
  let workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) {
    workspace = await createWorkspaceWithRAGFlow(...)
  }

  // 2. 创建/更新 Message
  const message = await upsertMessage(...)

  // 3. 自动打标签（inline 处理）
  if (workspace.enableAutoTag) {
    await applyAutoTags(...)
  }

  // 4. 同步到 RAGFlow（inline 处理）
  if (workspace.ragflowDatasetId) {
    await syncToRAGFlowWithDatasetId(...)
  }
}
```

---

### 方案 C：简化元数据结构

#### 当前 `workspace.json` 结构（过度复杂）

```json
{
  "version": 2,
  "workspace": {
    "id": "xxx",
    "originalFolderName": "知识库A",
    "currentFolderName": "知识库A_renamed", 
    "name": "知识库A",
    "lastSyncedAt": "2025-01-25T00:00:00Z"
  },
  "messages": {
    "message_xxx.md": {
      "id": "xxx",
      "type": "message",
      "originalFilename": "message_xxx.md",
      "currentFilename": "友好名称.md",
      "commentFolderName": "message_xxx",
      "created_at": "...",
      "updated_at": "...",
      "author": "user@example.com",
      "authorName": "User",
      "tags": "#tag1 #tag2"
    }
  },
  "comments": { ... }
}
```

#### 简化后结构

```json
{
  "version": 3,
  "workspaceId": "xxx",
  "files": {
    "友好名称.md": "message_id_xxx",
    "另一个文件.md": "message_id_yyy"
  }
}
```

**原则：**
- `workspace.json` 只存储 `文件名 → ID` 的映射
- 其他元数据（author、tags、created_at）从数据库读取
- 删除 `original/current` 双命名追踪

---

## 📁 简化后的文件结构

### 当前（18 个文件）
```
src/lib/
├── file-watcher/index.ts
├── queue/
│   ├── index.ts
│   ├── worker.ts
│   └── processors/
│       ├── create-workspace-from-folder.ts  ❌ 删除
│       ├── create-message-from-file.ts      ❌ 删除
│       ├── auto-tag.ts                      ❌ 合并
│       ├── auto-tag-extended.ts
│       ├── sync-ragflow.ts                  ❌ 合并
│       ├── sync-to-local.ts
│       └── daily-briefing.ts
├── sync-utils.ts                            ⚠️ 大幅简化
├── ragflow/provision.ts
└── tag-utils.ts
```

### 简化后（约 10 个文件）
```
src/lib/
├── file-watcher/index.ts          ✅ 保留，简化逻辑
├── queue/
│   ├── index.ts                   ✅ 保留
│   ├── worker.ts                  ✅ 简化
│   └── processors/
│       ├── sync-from-file.ts      🆕 合并后的处理器
│       ├── sync-to-file.ts        ✅ 重命名自 sync-to-local
│       ├── auto-tag-comment.ts    ✅ 保留
│       └── daily-briefing.ts      ✅ 保留
├── sync-utils.ts                  ✅ 大幅简化（只保留解析逻辑）
├── ragflow/provision.ts           ✅ 保留
└── tag-utils.ts                   ✅ 保留
```

---

## 🔧 关键代码修改指南

### 1. 简化 `file-watcher/index.ts`

**删除：**
- `processedFiles` Set（改为查询数据库）
- `processedFolders` Set（改为检查 `workspace.json`）
- `fileSkipCounts` Map（用文件锁替代）

**修改后的核心逻辑：**

```typescript
// 简化后的 scanWorkspaceFolder
function scanWorkspaceFolder(workspacePath: string) {
  const workspaceFile = path.join(workspacePath, ".whitenote", "workspace.json")
  
  // 读取已同步的文件列表
  const syncedFiles = fs.existsSync(workspaceFile)
    ? JSON.parse(fs.readFileSync(workspaceFile, "utf-8")).files || {}
    : {}
  
  // 扫描 .md 文件
  const mdFiles = fs.readdirSync(workspacePath)
    .filter(f => f.endsWith('.md'))
  
  for (const file of mdFiles) {
    if (!syncedFiles[file]) {
      // 新文件，添加到队列
      addTask("sync-from-file", { filePath: path.join(workspacePath, file) })
    }
  }
}
```

### 2. 合并 `sync-from-file.ts` 处理器

```typescript
// src/lib/queue/processors/sync-from-file.ts
import { Job } from "bullmq"
import prisma from "@/lib/prisma"
import { parseMdFile } from "@/lib/sync-utils"
import { provisionRAGFlowForWorkspace } from "@/lib/ragflow/provision"
import { syncToRAGFlowWithDatasetId } from "@/lib/ai/ragflow"
import { applyAutoTags } from "@/lib/ai/auto-tag"
import { batchUpsertTags } from "@/lib/tag-utils"
import * as fs from "fs"
import * as path from "path"

interface SyncFromFileJobData {
  filePath: string
}

export async function processSyncFromFile(job: Job<SyncFromFileJobData>) {
  const { filePath } = job.data
  const workspacePath = path.dirname(filePath)
  const filename = path.basename(filePath)

  // 1. 获取或创建 Workspace
  const workspaceFile = path.join(workspacePath, ".whitenote", "workspace.json")
  let wsData = JSON.parse(fs.readFileSync(workspaceFile, "utf-8"))
  
  let workspace = await prisma.workspace.findUnique({
    where: { id: wsData.workspaceId },
    include: { user: true }
  })

  if (!workspace) {
    // 自动创建 Workspace（inline，不再单独任务）
    const folderName = path.basename(workspacePath)
    const user = await prisma.user.findFirst()
    
    workspace = await prisma.workspace.create({
      data: { name: folderName, userId: user!.id }
    })
    
    // 创建 RAGFlow 资源
    const config = await prisma.aiConfig.findUnique({ where: { userId: user!.id } })
    if (config?.ragflowBaseUrl && config.ragflowApiKey) {
      const { datasetId, chatId } = await provisionRAGFlowForWorkspace(...)
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { ragflowDatasetId: datasetId, ragflowChatId: chatId }
      })
    }
  }

  // 2. 解析文件内容
  const content = fs.readFileSync(filePath, "utf-8")
  const { tags, content: body } = parseMdFile(content)

  // 3. 创建/更新 Message
  const tagIds = tags.length > 0 ? await batchUpsertTags(tags) : []
  
  const message = await prisma.message.upsert({
    where: { id: wsData.files?.[filename] },  // 如果已存在则更新
    update: { content: body },
    create: {
      content: body,
      authorId: workspace.userId,
      workspaceId: workspace.id,
      tags: { create: tagIds.map(tagId => ({ tagId })) }
    }
  })

  // 4. 自动打标签（inline）
  if (workspace.enableAutoTag && !tags.length) {
    await applyAutoTags(workspace.userId, message.id)
  }

  // 5. 同步到 RAGFlow（inline）
  if (workspace.ragflowDatasetId) {
    await syncToRAGFlowWithDatasetId(...)
  }

  // 6. 更新 workspace.json
  wsData.files = wsData.files || {}
  wsData.files[filename] = message.id
  fs.writeFileSync(workspaceFile, JSON.stringify(wsData, null, 2))
}
```

### 3. 简化 `sync-utils.ts`

**删除：**
- V1 迁移代码（`migrateV1ToV2`）
- `originalFilename` / `currentFilename` 追踪逻辑
- `commentFolderName` 管理

**保留：**
- `parseMdFile()` - 解析标签和内容
- `generateFriendlyName()` - 生成友好文件名
- `ensureDirectoryExists()` - 工具函数

---

## ⚡️ 迁移步骤

### 第一阶段：准备工作

1. 备份现有的 `link_md/` 目录
2. 导出数据库数据

### 第二阶段：代码重构

1. 创建新的 `sync-from-file.ts` 处理器
2. 更新 `queue/index.ts` 的任务类型定义
3. 更新 `queue/worker.ts` 的任务路由
4. 简化 `file-watcher/index.ts`
5. 删除不再需要的处理器文件

### 第三阶段：数据迁移

1. 将现有的 `workspace.json` 转换为 V3 格式：

```typescript
// 迁移脚本示例
function migrateWorkspaceJson(oldData: WorkspaceDataV2): WorkspaceDataV3 {
  const files: Record<string, string> = {}
  
  for (const [key, meta] of Object.entries(oldData.messages)) {
    files[meta.currentFilename] = meta.id
  }
  
  return {
    version: 3,
    workspaceId: oldData.workspace.id,
    files
  }
}
```

### 第四阶段：测试验证

1. 创建新 Workspace（文件夹）
2. 添加 .md 文件
3. 验证数据库记录
4. 验证 RAGFlow 同步

---

## 📊 预期收益

| 指标 | 当前 | 简化后 |
|------|------|--------|
| 核心文件数 | 18 | ~10 |
| 队列任务类型 | 7 | 4 |
| 任务链长度 | 5 步 | 1 步 |
| workspace.json 字段数 | ~15 | ~3 |
| sync-utils.ts 行数 | ~1300 | ~200 |

---

## ⚠️ 注意事项

1. **向后兼容**：迁移时需要处理已存在的 V1/V2 数据
2. **RAGFlow 依赖**：简化后仍需保留 RAGFlow 的初始化流程
3. **Comment 特殊处理**：评论的同步逻辑可能需要单独处理
4. **文件重命名**：简化后不再追踪文件重命名，用户需自行管理

---

## 🤔 建议选择

如果你的主要使用场景是：

- **Obsidian 用户，文件为主** → 选择方案 A1 + B + C
- **Web 用户，数据库为主** → 选择方案 A2 + B + C
- **必须双向同步** → 选择方案 B + C（复杂度降低约 50%）

最推荐：**方案 A1**（文件系统为主） + **方案 C**（简化元数据），可将复杂度降低 60-70%。
