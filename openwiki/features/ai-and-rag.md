# AI 与 RAG

Mirror 把 AI 能力贯穿整个输入器：文本输入可通过 `@goldierill` 或 `@rag` 触发 AI 回复；语音输入会先经过 ASR 转写再进入同样的 AI 管线；后台还会按 Workspace 把消息向量化，做本地 RAG 检索。

## 双提及模式（核心约定）

源：`src/lib/utils/ai-detection.ts`、`src/components/{InputMachine,PostDialog,CommentsList,ReplyDialog,RetweetDialog}.tsx`、`src/app/api/ai/chat/route.ts`。

- `@goldierill`：走 OpenAI 兼容接口的普通对话，系统 prompt 中会附带评论线程上下文（`getCommentThreadContext`）。
- `@rag`：先尝试本地 `sqlite-vec` 检索（`searchRAG`），失败或未配置 Embedding 时回退到 RAGFlow（要求 Workspace 设置 `ragflowChatId`）。
- 当两条提及同时出现，**`@rag` 优先**（`detectAIMention` 实现），并把对应 token 从内容中剥离后再发请求。
- 检测结果会从 `detectAIMention(content)` 拿到：`{ hasMention, mode: 'goldierill' | 'rag' | null, cleanedContent }`。
- 客户端统一调用：`aiApi.chat({ messageId, content, mode })`（`POST /api/ai/chat`）。

### 服务端分支（`src/app/api/ai/chat/route.ts`）

```text
POST /api/ai/chat  { messageId, content, mode? }
  ├─ requireAuth()            // 未登录 401
  ├─ prisma.message.findUnique({ id, authorId })
  ├─ getAiConfig(session.user.id)
  ├─ mode === 'rag' 分支
  │    ├─ hasEmbedding && workspaceId → sqlite-vec searchRAG + callOpenAI
  │    └─ 否则 RAGFlow（callRAGFlowWithChatId），要求 ragflowChatId + ragflow 配置
  └─ mode === 'goldierill' 分支
       └─ callOpenAI，附带评论线程上下文
  └─ 写一条 isAIBot=true 的 Comment，附带 RAG 命中时解析出的 quotedMessageId
  └─ 若 workspace.enableAutoTag，addTask('auto-tag-comment', ...)
```

注意：AI 回复 **不会** 被 RAG 同步任务收集（`sync-rag` 处理器过滤 `isAIBot=true`），避免「AI 引用 AI」循环。

## RAG 检索路径

### 主路径：sqlite-vec

- 入口：`src/lib/ai/rag.ts` 的 `searchRAG(userId, workspaceId, query, options)`。
- 数据来源：`MessageEmbedding` 表，由 `process-message` 后台任务在创建 / 更新消息时调用 Embedding API 写入。
- 命中结果会映射为 `{ sourceId, content }`，并把第一条结果的 `sourceId` 当作 `quotedMessageId` 回写到 AI 评论上，方便用户回溯。

### 回退：RAGFlow

- 入口：`src/lib/ai/ragflow.ts`，主要函数 `callRAGFlowWithChatId(baseUrl, apiKey, chatId, messages)`。
- 触发条件：
  - 用户未配置 Embedding（`config.embeddingApiKey` 为空），或
  - 消息没有 Workspace，或
  - 本地 RAG 不可用且 Workspace 已绑定 `ragflowChatId`。
- 返回结构：`{ content, references: [{ content, source }] }`；服务端从 `references[0].source` 解析 `message_xxx.md` 文件名得到 `messageId`，作为引用来源。
- 失败处理：捕获后返回 500 + 中文错误文案；前端用 `useToast` 提示。

### 上下文（`@goldierill`）

- `src/lib/ai/thread-context.ts`：`getCommentThreadContext(messageId)` 把整条消息的评论树压平成 LLM 可读的字符串，附在用户提问之前。
- 系统 prompt：`src/lib/ai/openai.ts` 的 `buildSystemPrompt(userId)`，会拼接 `AIConfig.aiPersonality`、`aiExpertise` 等人格字段。

## AI Commands（AI 命令面板）

- 模型：`AICommand(id, label, description, action, prompt, isBuiltIn, authorId)`，位于 `prisma/schema.prisma`，TS 类型见 `src/types/api.ts`。
- API：`src/lib/api/ai-commands.ts` 提供 CRUD；后端在 `src/app/api/ai-commands/**/route.ts`。
- UI：`src/app/settings/ai-commands/page.tsx` 管理命令；`InputMachine` 的 SlashCommand 菜单内置内置命令 + 用户自定义命令（按 `isBuiltIn` 与 `authorId` 区分）。

## AI 增强（Enhance）

- API：`aiApi.enhance({ action: 'summarize' | 'translate' | 'expand' | 'polish', content, target? })`，对应 `POST /api/ai/enhance`。
- 用于在输入器旁提供「总结 / 翻译 / 扩写 / 润色」等辅助能力（具体触发组件位于 `InputMachine` / `PostDialog` 等）。

## 语音转写（ASR）

- 录音：`InputMachine` 使用 `MediaRecorder`；优先尝试 `audio/mpeg` / `audio/mp3`，失败回退 `audio/webm`。
- 上传：直接 POST 到 SiliconFlow 默认端点 `https://api.siliconflow.cn/v1/audio/transcriptions`，模型 `TeleAI/TeleSpeechASR`。
- 鉴权：
  - 优先 `sessionStorage.asr_api_key`（用户在设置面板临时覆盖）。
  - Fallback 使用后端 `AIConfig.asrApiKey`（在 `getAiConfig()` 中暴露给前端）。
- 转写结果以 Markdown 形式 `editor.commands.insertContent(...)` 注入编辑器。

## AI 配置（AIConfig）

UI：`src/app/settings/ai-config/page.tsx`，对应 `src/components/AIConfigForm.tsx`。

分块（Section）：

1. **OpenAI 配置**：`baseUrl` / `apiKey` / `model`，以及人格化字段 `aiPersonality`、`aiExpertise`。
2. **RAGFlow 配置**：`baseUrl` / `apiKey` / `ragTimeFilterStart|End`。
3. **Embedding 配置**：`embeddingBaseUrl`、`embeddingApiKey`、`embeddingModel`；配置后启用 sqlite-vec RAG 主路径。
4. **自动打标模型**：`autoTagModel`，控制自动标签任务使用的模型。
5. **链接推荐 / Markdown 同步**：开关 + `mdSyncDir` 路径。
6. **ASR**：`asrApiKey`、`asrApiUrl`，与 `sessionStorage` 临时值配合使用。

每次保存都会覆盖 `AIConfig`；前端通过 `configApi` / `aiConfigApi`（位于 `src/lib/api/config.ts`）读取与更新。

## 流式 AI 回复（Streaming）

- 客户端组件持有 `isAiStreaming` / `aiStreamingResponse` 状态（`InputMachine`、`PostDialog`、`ReplyDialog`、`RetweetDialog`、`CommentsList`）。
- 触发条件：内容中包含 `@goldierill` / `@rag` 且请求的是流式端点（部分场景）。
- `@rag` 模式注释明确「使用非流式 API，立即发帖」（见各组件 `if (aiDetection.mode === 'rag')` 分支），因为 RAG 需要先完成检索再回答。

## 关键源文件索引

- `src/lib/ai/openai.ts` — `buildSystemPrompt`、`callOpenAI`。
- `src/lib/ai/rag.ts` — `searchRAG`（sqlite-vec）。
- `src/lib/ai/ragflow.ts` — `callRAGFlowWithChatId`。
- `src/lib/ai/thread-context.ts` — `getCommentThreadContext`。
- `src/lib/ai/config.ts` — `getAiConfig`（用户维度 AIConfig）。
- `src/lib/utils/ai-detection.ts` — `detectAIMention` / `hasAIMention` / `getAIMode`。
- `src/app/api/ai/chat/route.ts` — 双提及路由。
- `src/app/api/ai/enhance/route.ts` — Enhance 路由。
- `src/components/AIConfigForm.tsx`、`src/app/settings/ai-config/page.tsx` — 配置 UI。
- `src/components/InputMachine.tsx` — 录音 + ASR + 富文本入口。

## 改动前的检查清单

- 新增 AI 字段：同步 `AIConfig` 模型、`UpdateAIConfigInput` 类型、`AIConfigForm` 表单、`getAiConfig` 读取逻辑。
- 调整 RAG 行为：检查 `process-message`（写入向量）、`searchRAG`（检索）、`/api/ai/chat`（rag 分支）三处。
- 调整提及规则：只改 `detectAIMention` 与 `/api/ai/chat` 的 mode 解析；所有引用方都会自动跟随。
- 涉及 AI 评论：确认 `sync-rag` 任务仍过滤 `isAIBot=true`，否则会出现循环引用。