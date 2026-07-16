# 内容与互动：时间线、帖子、评论

本文汇总用户在 Mirror 中能直接看到的核心交互：时间线浏览、发推、引用、转发、评论 / 回复，以及排序规则。所有路径都涉及 `Message` 与 `Comment` 实体，详见 `architecture/data-model.md`。

## 时间线

- 入口：`src/app/page.tsx`（默认 Workspace）、`src/app/workspace/[id]/page.tsx`（指定 Workspace）。
- 数据来源：`messagesApi.getMessages({ workspaceId, page, limit, tagId, isStarred, isPinned })`，对应 `GET /api/messages`。
- 渲染链路：`MessageList → MessageItem`，每条 `MessageItem` 内部还挂载 `CommentsList`（按需懒加载）。
- 筛选与排序：当前 Workspace、标签、星标、置顶；时间倒序展示。`Message.isPinned=true` 的消息会在前端单独置顶显示。

## 发帖

- 入口组件：`src/components/InputMachine.tsx`、`src/components/PostDialog.tsx`。
- `InputMachine` 是核心富文本编辑器（TipTap），位于时间线顶部，支持：
  - **Markdown** / 表格 / 代码块（lowlight 高亮）/ 图片 / SlashCommand。
  - **媒体上传**：通过 `MediaUploader` ref 上传到对象存储（实现位于 `src/components/MediaUploader.tsx`，落库走 `MessageMedia` / `CommentMedia`）。
  - **模板**：挂载时通过 `templatesApi.getTemplates()` 拉取用户模板（含内置），并在 SlashCommand 中列出。
  - **语音输入**：`MediaRecorder` 录音 → POST 到 SiliconFlow ASR（`TeleAI/TeleSpeechASR`），转写文本以 Markdown 形式回插编辑器。API Key 通过 `sessionStorage.asr_api_key` 读取；fallback 使用 `AIConfig.asrApiKey`。
  - **AI 提及**：`@goldierill` / `@rag` 触发 AI 回复（详见 `features/ai-and-rag.md`）。
- 提交时调用 `messagesApi.createMessage({ content, title?, tags?, quotedMessageId?, quotedCommentId?, media?, workspaceId })`（`POST /api/messages`）。
- 服务端创建 `Message` 记录后，立即 `addTask('process-message', ...)`，由后台任务执行打标 / 链接推荐 / 向量化。

## 引用与转发

### 引用（Quoted）

- 发帖时携带 `quotedMessageId` 或 `quotedCommentId`，目标内容会渲染为「引用卡片」。
- `Message` 模型直接持 `quotedMessageId` / `quotedCommentId` 字段；`Comment` 模型另有简化版的 `quotedMessage` 字段（schema 中的 `quotedMessageId`，对应 `QuotedMessage` 视图）。

### 转发（Retweet）

- 通过 `messagesApi.toggleRetweet(messageId)` 触发（`POST /api/messages/[id]/retweet`）。
- 由 `MessageRetweet(userId, messageId)` 表记录；UI 上展示 retweet 计数与是否已转发。
- 评论也有 `CommentRetweet` / `commentsApi.toggleRetweet(commentId)`。

## 评论与回复

- 列表组件：`src/components/CommentsList.tsx`。
  - 通过 `commentsApi.getComments(messageId)` 加载；支持懒加载子回复（`getChildComments(parentId)`）。
  - 排序依据由 `Message.authorCommentSortOrder` 控制：
    - `false`（默认）：按 `createdAt` 升序，时间线式展开。
    - `true`：作者的回复置顶（Mirror 自定义「作者优先」体验）。
  - 任意评论可通过 `getCommentPath(commentId)` 取得祖先链，用于深链跳转。
- 回复入口：`src/components/ReplyDialog.tsx`（弹窗 + 富文本）、`src/components/CompactReplyInput.tsx`（行内简洁形态）。
- AI 回复：当评论内容含 `@goldierill` 或 `@rag` 时，同样走 `aiApi.chat(...)`，生成的 `Comment` 会带 `isAIBot=true`（详见 `features/ai-and-rag.md`）。
- 写操作：
  - `commentsApi.createComment({ messageId, content, parentId?, media? })`（`POST /api/messages/[id]/comments`）。
  - `commentsApi.updateComment(commentId, { content, tags? })`（`PATCH /api/comments/[id]`）。
  - `commentsApi.deleteComment(commentId)`（`DELETE /api/comments/[id]`）。

## Star / Pin

- 消息：`messagesApi.toggleStar(id)` / `togglePin(id)`；列表接口支持 `?isStarred=true&isPinned=true`。
- 评论：`commentsApi.toggleStar(commentId)`；列表接口支持 `getStarredComments()`。
- 收藏 / 置顶均通过 `*Star` / `*Retweet` 桥接表建模，便于唯一性约束与计数。

## 排序与作者偏好

- 「作者优先」开关：每条消息作者可独立决定是否让自己的评论置顶（`Message.authorCommentSortOrder`）。前端在 `CommentsList` 中读取并切换排序方式。
- 对回复嵌套的渲染策略：
  - 第一层按时间正序展开（`CommentsList`）。
  - 展开某条评论的子回复时使用 `getChildComments`，按需加载。

## 路由快捷入口

| 路径 | 说明 |
| --- | --- |
| `/` | 默认 Workspace 时间线 |
| `/workspace/[id]` | 指定 Workspace |
| `/messages/[id]` | 单条消息详情（含全部评论） |
| `/messages/[id]/comments/[commentId]` | 锚定到某条评论的深链 |
| `/search?q=...` | 全局搜索（混合消息 + 评论） |

## 关键源文件索引

- `src/components/InputMachine.tsx` — 富文本、语音、模板、AI 提及主入口。
- `src/components/PostDialog.tsx` — 弹窗式发帖（含 AI 提及、AI 流式回复）。
- `src/components/CommentsList.tsx` — 评论列表、排序、AI 提及、AI 流式回复。
- `src/components/ReplyDialog.tsx` — 回复弹窗 + AI 提及。
- `src/components/RetweetDialog.tsx` — 转发弹窗 + AI 提及。
- `src/components/CompactReplyInput.tsx` — 行内回复。
- `src/lib/api/messages.ts`、`src/lib/api/comments.ts` — 前端 API 客户端。
- `src/lib/utils/ai-detection.ts` — AI 提及检测。

## 改动前的检查清单

- 引入新的评论字段：先更新 `prisma/schema.prisma` 与 `src/types/api.ts`，再同步 `CommentsList` 渲染。
- 调整排序：先确认是否影响深链路径（`messageAuthorCommentSortOrder` 改变只是 UI 行为，不影响数据）。
- 任何写接口：记得在服务端创建记录后 `addTask` 对应任务（process-message、auto-tag 等），保持流水线一致。