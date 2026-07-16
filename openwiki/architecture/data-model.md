# 数据模型（Prisma Schema）

本文基于 `prisma/schema.prisma` 总结核心实体、字段与关系，便于在阅读业务代码前快速定位数据形态。

## 概览图

```
User ───< Message >─── Workspace
   │         │              │
   │         │              ├──< Tag (via MessageTag)
   │         │              ├──< Media
   │         │              └──< MessageLink  (process-message 产物)
   │         │
   │         ├──< Comment (parentId 自引用、quotedMessageId 反向引用)
   │         │      └──< CommentTag / CommentMedia
   │         │
   │         ├──< MessageStar
   │         ├──< MessageRetweet
   │         ├──< MessageEmbedding  (sqlite-vec 向量)
   │         └──< AiProcessingJob  (异步任务状态)
   │
   ├──< CommentStar
   ├──< CommentRetweet
   ├──< AIConfig
   ├──< AICommand
   └──< Workspace
```

## 关键实体

### User

- 来源：NextAuth 表（`Account`、`Session`、`VerificationToken` 同源）。
- 关键字段：`id`、`name`、`email`、`image`、`emailVerified`。
- 关联：一对多 `Message`、`Comment`、`AIConfig`、`AICommand`、`Workspace`。

### Workspace

- 定义：隔离用户内容、标签与 AI 行为的容器。
- 关键字段：
  - `id`、`name`、`description`、`isDefault`、`userId`。
  - `ragflowDatasetId` / `ragflowChatId`：与 RAGFlow 集成的标识；用于 RAG 回退路径。
  - `enableAutoTag`：开启后新建消息 / 评论会触发自动打标任务。
- 关系：一对多 `Message`、`Tag`（标签在 Workspace 范围内去重）。

### Message

- 角色：推文式知识库的主条目。
- 关键字段：
  - `content`、`title`、`isStarred`、`isPinned`、`authorId`、`workspaceId`。
  - `quotedMessageId` / `quotedCommentId`：引用上层内容。
  - `authorCommentSortOrder`：作者是否启用「自己优先」的评论排序（影响 `CommentsList` 的排序逻辑）。
- 关系：
  - 多对一 `User`、`Workspace`。
  - 一对多 `Comment`、`MessageTag`、`MessageMedia`、`MessageStar`、`MessageRetweet`、`MessageLink`、`MessageEmbedding`、`AiProcessingJob`。

### Comment

- 角色：消息下的评论 / 回复。
- 关键字段：
  - `content`、`messageId`、`authorId`、`parentId`（自引用，支持嵌套回复）。
  - `quotedMessageId` / `quotedMessage`：在评论中引用其它消息（简化版 schema）。
  - `isAIBot=true`：AI 回复标记（用于 RAG 同步时过滤）。
  - `isStarred`、`messageAuthorCommentSortOrder`：用于排序 / 收藏。
- 关系：
  - 多对一 `Message`、`User`。
  - 一对多自引用（parent → children）。
  - 一对多 `CommentTag`、`CommentMedia`、`CommentStar`、`CommentRetweet`。

### Tag

- Workspace 内唯一：组合唯一键 `(workspaceId, name)`。
- 关联：`MessageTag` / `CommentTag` 多对多桥接表。

### Media

- 通用媒体附件，可挂到 `Message` 或 `Comment`：
  - `MessageMedia(messageId, mediaId)`、`CommentMedia(commentId, mediaId)`。
- 关键字段：`url`、`type`（image / video / file 等）、`description`（可由 ASR / AI 补全）。

### AIConfig

- 关键字段（与 `src/types/api.ts` 中 `AIConfig` 同步）：
  - OpenAI：`openaiBaseUrl`、`openaiApiKey`、`openaiModel`、`aiPersonality`、`aiExpertise`。
  - RAGFlow：`ragflowBaseUrl`、`ragflowApiKey`、`ragTimeFilterStart/End`。
  - Embedding：`embeddingBaseUrl`、`embeddingApiKey`、`embeddingModel`。
  - ASR：`asrApiKey`、`asrApiUrl`（默认 SiliconFlow TeleSpeechASR 端点）。
  - 其它：`autoTagModel`、`enableLinkSuggestion`、`enableMdSync`、`mdSyncDir`。
- 一对一 `User`：每位用户一份配置。

### AICommand

- 关键字段：`label`、`description`、`action`、`prompt`、`isBuiltIn`、`authorId`。
- 关系：`User`，但 `isBuiltIn=true` 时 `authorId=null`，表示全局内置命令。

### MessageLink / MessageEmbedding / AiProcessingJob

这些都是 `process-message` 流水线的产物表：

- **MessageLink**：`fromMessageId → toMessageId` 的有向链接（链接推荐、`enableLinkSuggestion=true` 时填充）。
- **MessageEmbedding**：与 sqlite-vec 协作的向量表（chunk 级别），用于本地 RAG 检索。
- **AiProcessingJob**（枚举 `AiProcessingStatus`）：跟踪每个 Message 的处理状态（`PENDING / PROCESSING / COMPLETED / FAILED`），常用于 UI 显示「AI 处理中」徽标。

### Star / Retweet

- 通用收藏 / 转发：
  - `MessageStar(messageId, userId)`、`MessageRetweet(messageId, userId)`。
  - `CommentStar(commentId, userId)`、`CommentRetweet(commentId, userId)`。
- 复合主键避免重复。

## 重要枚举

- `AiProcessingStatus`：`PENDING / PROCESSING / COMPLETED / FAILED`（驱动 UI 上的「AI 处理中」状态条）。
- 在 `src/types/api.ts` 中另有 `type: 'message' | 'comment'` 的搜索结果联合类型，不直接落库但被搜索 API 使用。

## 索引与查询要点

- `Message` 主要按 `workspaceId`、`createdAt` 排序查询；在 Prisma 层按需添加复合索引。
- `Comment` 主要按 `messageId`、`parentId` 查询；排序依据 `createdAt` 或作者偏好。
- 搜索接口会返回混合 `Message` / `Comment` 结果（`SearchResultItem` 联合类型），由 `type` 字段区分。
- RAG 检索优先走本地 `MessageEmbedding`（sqlite-vec），命中失败再走 RAGFlow。

## 迁移与种子

- 迁移历史：`prisma/migrations/`。新增字段时务必用 `pnpm prisma migrate dev --name <descriptive>`。
- 种子：`prisma/seed.ts` 创建默认用户（取决于实现）、Workspace、若干示例消息 / 评论 / 标签，便于本地体验。
- 启动命令：`pnpm prisma migrate dev` 之后再 `pnpm prisma db seed`；`pnpm dev` 默认也会触发 seed。

## 阅读建议

- 业务字段含义模糊时（如 `messageAuthorCommentSortOrder`），回到 `src/components/CommentsList.tsx` 看排序逻辑。
- 调试 AI 回复为何没被 RAG 引用：检查 `Comment.isAIBot` 与 `sync-rag` 任务的过滤条件。