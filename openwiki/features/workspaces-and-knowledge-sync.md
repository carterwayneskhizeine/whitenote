# 工作区与知识同步

Mirror 把用户的「笔记 / 推文 / 评论 / 标签 / AI 行为」都放进 Workspace 容器里，再通过 Markdown 同步与 RAG 索引把内容沉淀为可检索的知识。

## Workspace

### 模型

- 实体：`Workspace(id, name, description, isDefault, userId, ragflowDatasetId, ragflowChatId, enableAutoTag, createdAt, updatedAt)`。
- 关键约束：
  - 每个用户至少一个 Workspace（`isDefault=true`）；新建用户时由 seed / 注册流程创建。
  - **标签在 Workspace 内唯一**：`Tag(workspaceId, name)` 组合唯一。
  - **RAGFlow 绑定**：可选字段，决定回退路径是否启用。

### 切换

- 全局状态：`src/lib/stores/workspace.ts`（Zustand），键 `currentWorkspaceId`，持久化到 localStorage。
- 入口：`src/components/Header.tsx` / `src/components/Sidebar.tsx` 中的 Workspace 切换器；切换后会跳转到 `/workspace/[id]`。
- 影响面：
  - `messagesApi.getMessages` 自动带 `workspaceId`，过滤消息。
  - `tagsApi` 返回当前 Workspace 下的标签。
  - RAG 检索只搜当前 Workspace 的向量索引。
  - AI 自动打标任务按 Workspace 维度派发。

### 管理

- 路径：`src/app/settings/workspaces/page.tsx`。
- API：`src/app/api/workspaces/**/route.ts`。
- 字段：`name`、`description`、`enableAutoTag`、`ragflowDatasetId`、`ragflowChatId`。

## Markdown 同步（`enableMdSync`）

- 配置开关：`AIConfig.enableMdSync` + `AIConfig.mdSyncDir`。
- 路由：`src/app/api/ai/md-sync/route.ts`（按仓库中实际命名）。
- 行为：把当前用户 / Workspace 的消息以 Markdown 文件形式导出到 `mdSyncDir`，可作为外部知识源（如 RAGFlow / 第三方语料）使用。
- AI 评论（`isAIBot=true`）是否同步取决于实现细节；建议在改动前先在 `src/lib/md-sync/` 中确认过滤逻辑。

## RAG 索引（`process-message` → `MessageEmbedding`）

- 触发：每次创建 / 更新消息时，由 `addTask('process-message', { userId, messageId, ... })` 异步执行。
- 写入：调用 Embedding API（`AIConfig.embeddingBaseUrl/ApiKey/Model`），把内容切片并写入 `MessageEmbedding` 表（与 sqlite-vec 协同）。
- 检索：`src/lib/ai/rag.ts` 的 `searchRAG(userId, workspaceId, query)` 在 sqlite-vec 中执行向量近似检索，返回 top-k。
- AI 回复过滤：`sync-rag` 任务刻意跳过 `isAIBot=true` 的 Comment，防止 AI 引用 AI。
- 时间窗过滤：`AIConfig.ragTimeFilterStart / ragTimeFilterEnd`（被 RAGFlow 回退路径使用；sqlite-vec 主路径当前不强制，但写入端可在 `process-message` 中按需应用）。

## AI 评论的特殊身份

- `Comment.isAIBot=true`：所有 AI 回复（`@goldierill` / `@rag` 命中后产生的回复）都会带上这个标志。
- 用途：
  - **RAG 过滤**：`sync-rag` 任务跳过，避免检索到 AI 自己生成的「二手内容」。
  - **自动打标**：可被 `auto-tag-comment` 任务命中，行为与普通评论一致。
  - **UI 展示**：通常以特殊样式 / 头像区分；具体样式在 `CommentsList` 与 `MessageItem` 中查找。

## 自动打标（`auto-tag-message` / `auto-tag-comment`）

- 入口：`addTask('auto-tag-message' | 'auto-tag-comment', { userId, workspaceId, messageId|commentId, contentType })`。
- 触发条件：`Workspace.enableAutoTag=true`。
- 行为：使用 `AIConfig.autoTagModel` 为内容打标签，并把结果写入 `MessageTag` / `CommentTag`。
- 关闭：把 Workspace 上的开关关闭即可停止自动打标，已打标签不会被自动清除。

## 链接推荐（`enableLinkSuggestion`）

- 配置：`AIConfig.enableLinkSuggestion`。
- 行为：`process-message` 流水线里会基于 Embedding / 文本相似度建议相关历史消息，并写入 `MessageLink` 表（`fromMessageId → toMessageId`）。
- UI：通常在 `MessageItem` 末尾或详情页列出「相关链接」。

## 关联任务总览

| 任务类型 | 触发位置 | 关键依赖 |
| --- | --- | --- |
| `process-message` | 消息创建 / 更新后 | Embedding、链接推荐、自动打标（按开关） |
| `sync-rag` | 显式调用 / 周期任务 | 过滤 `isAIBot=true`，写入向量 |
| `auto-tag-message` | `process-message` 末尾 | `Workspace.enableAutoTag`、`autoTagModel` |
| `auto-tag-comment` | AI 回复创建后 | 同上 |
| `search-message` | 搜索接口需要时 | 全文 / 向量混合检索 |
| `md-sync` | 用户触发或周期任务 | `enableMdSync`、`mdSyncDir` |

> 上述任务的具体 worker 实现位于 `src/lib/queue.ts` 的注册处；初始化阶段未深入阅读每个处理函数，后续更新可以补全。

## 关键源文件索引

- `src/lib/stores/workspace.ts` — Workspace 状态。
- `src/components/Header.tsx`、`src/components/Sidebar.tsx` — Workspace 切换器。
- `src/app/settings/workspaces/page.tsx` — Workspace 管理。
- `src/lib/md-sync/*` — Markdown 同步实现（如存在）。
- `src/app/api/ai/md-sync/route.ts` — Markdown 同步 API。
- `src/lib/ai/rag.ts` — 向量检索。
- `src/lib/queue.ts` — 后台任务定义与调度。

## 改动前的检查清单

- 新增 Workspace 字段：同步 schema、`Workspace` / `CreateWorkspaceInput` / `UpdateWorkspaceInput` 类型、设置页表单。
- 调整 RAG 行为：检查写入端（`process-message`）、读取端（`searchRAG`）、AI 回复过滤（`sync-rag`）三处。
- 调整自动打标：注意只在 `enableAutoTag=true` 时执行；改写 `AIConfig.autoTagModel` 时记得同步 `AIConfigForm`。
- 调整 Markdown 同步：评估对 AI 评论的过滤策略是否符合预期，避免 AI 内容污染外部语料。