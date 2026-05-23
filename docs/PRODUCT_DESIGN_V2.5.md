# WhiteNote 2.5 (Personal Brain X) 产品设计文档

**版本**: 2.5.1 (Multi-User + Realtime Sync)  
**日期**: 2026-01-02  
**核心定义**: 一个伪装成 X (Twitter) 时间线风格的**多用户**知识管理与 AI 记忆系统。它结合了 Notion 的结构化能力与 Twitter 的碎片化记录体验，由双模 AI 驱动，支持**实时多端同步编辑**，旨在解决"记录压力大"与"回顾困难"的个人知识库痛点。

---

## 目录

1. 项目愿景与核心目标
2. 技术架构
3. 访问控制与安全模型
4. 核心功能模块
5. 双模 AI 策略与自动化体系
6. 数据库设计 (Prisma Schema)
7. 关键业务逻辑描述
8. 未来路线图

---

## 1. 项目愿景与核心目标

### 1.1 WhiteNote 是一个完全属于用户的第二大脑。

- **Private Note** (私有笔记): 仅限你 (Owner) 和 AI 助手 (@goldierill) 访问。所有想法、吐槽和知识均在此自由流动，无需担心隐私泄露。
- **Public Note** (公开笔记): 可将 Private Note 转换为 Public Note，通过分享链接让任何人查看。

### 1.2 核心目标

1. **极速捕获**: 像发推特一样毫无压力地记录碎片想法，同时支持 Notion 风格的 **Slash Command (`/`)** 快捷指令。
2. **结构化沉淀**: 引入 **Thread (串)** 和 **Auto-Tagging (自动标签)**，将碎片化内容编织成知识网络，避免"写后即忘"。
3. **主动式智能**: AI 不再是被动的问答机器，它会**主动整理**（后台打标），成为真正的第二大脑。
4. **双模思考**: 区分"快思考"（直接调用 LLM）与"慢思考"（RAGFlow 记忆检索）。
5. **知识可视化**: 通过知识图谱将标签和笔记的关系网络可视化，帮助用户发现隐藏的知识连接。

---

## 2. 技术架构

| **模块** | **技术选型** | **说明** |
|----------|--------------|----------|
| **前端框架** | **Next.js v22.18.0** | App Router, Server Actions |
| **UI 系统** | **Tailwind + Shadcn/ui** | 极简主义设计，黑白灰主色调 |
| **富文本引擎** | **Tiptap** | 支持 Slash Command 菜单 (`/`)，支持 Markdown，支持双向链接 |
| **图谱可视化** | **D3.js / Force Graph** | 知识图谱交互式可视化 |
| **数据库** | **SQLite** | 核心数据存储，轻量级嵌入数据库 |
| **ORM** | **Prisma** | 类型安全的数据操作 |
| **RAG 引擎** | **RAGFlow** (Docker) | 知识库向量化与检索，支持配置热更新 |
| **任务队列** | **In-process Queue** | 处理 AI 自动打标等后台异步任务 |
| **实时同步** | **Socket.io** | 多端实时同步编辑 |


---

## 3. 访问控制与安全模型

**多用户系统**（同一服务器部署多用户，数据完全隔离）：

- **用户注册/登录**: 支持用户自主注册，每个用户拥有独立的数据空间
- **数据隔离**: 用户 A 无法访问用户 B 的任何数据（消息、标签、模板等）
- **Guest Zone (访客)**: 仅能访问通过 Token 生成的特定分享链接，且处于沙箱模式
- **敏感数据**: API Key 和 RAG 配置存储在数据库中，仅后端可见，绝不暴露给前端浏览器

---

## 4. 核心功能模块

### 4.1 增强版时间线 (Timeline+)

- **Thread 模式 (串)**: 允许用户针对自己的一条笔记进行"回复"，形成长链条的主题讨论（如 `#项目A` 的开发日志）。主时间线默认折叠 Thread，保持清爽。
- **混合输入体验**:
  - 默认是简单的推文输入框。
  - 输入 `/` 呼出命令菜单：支持插入代码块、Todo 列表、上传图片、**呼叫 AI 润色**、**插入模板**。
- **侧边栏话题**: 新增 "Trending/Topics" 区域，根据笔记中的标签热度自动排序，点击即可过滤时间线。
- **置顶**: 重要笔记可置顶到时间线顶部。

### 4.2 双向链接系统 (Bi-directional Links) 🆕

- **语法**:
  - `[[笔记标题]]`: 引用笔记。
  - `[[#标签]]`: 引用标签。
- **稳健性设计 (Robustness)**:
  - **Alias (别名) 重定向**: 当笔记重命名时，旧标题自动保留为“别名”。旧链接 `[[Old Title]]` 不会失效，会自动解析到目标笔记。
  - **ID 锚定**: 虽然底层解析依赖标题/别名，但 API 返回的 Link 关系基于稳定的 UUID (`sourceId` -> `targetId`)。
- **自动反向链接**: 系统自动追踪哪些笔记引用了当前笔记，在笔记底部显示 "Backlinks" 面板。
- **悬浮预览**: 鼠标悬停在链接上时，显示目标笔记的预览卡片，无需跳转即可快速浏览。
- **智能补全**: 输入 `[[` 后自动弹出搜索框，实时匹配已有笔记标题和别名。

### 4.3 知识图谱 (Knowledge Graph) 🆕

- **全局图谱视图**: 可视化展示所有笔记和标签的关系网络。
  - 节点：笔记 (圆形) 和标签 (方形)。
  - 边：双向链接关系和标签归属关系。
- **局部图谱**: 在单条笔记详情页中，展示与该笔记直接相关的邻居节点（深度 1-2 层）。
- **交互功能**: 点击节点跳转、拖拽布局、缩放平移、筛选特定标签。

### 4.4 模板系统 (Templates) 🆕

- **内置模板**: 预装常用模板：
  - 📅 每日日记 (Daily Journal)
  - 💡 想法捕捉 (Quick Idea)
- **自定义模板**: 用户可将任意笔记保存为模板。
- **调用方式**: 
  - Slash Command `/template [模板名]`

### 4.5 全局搜索增强 (Advanced Search) 🆕

- **全文搜索**: 基于 SQLite 全文索引，毫秒级响应。
- **高级过滤器**:
  - 按标签过滤: `tag:#React`
  - 按时间范围: `date:2025-12..2026-01`
  - 按媒体类型: `has:image`, `has:code`
  - 按收藏状态: `is:starred`
- **搜索历史**: 记录最近 20 条搜索，支持一键重用。
- **AI 语义搜索**: 启用 RAG 模式后，支持自然语言查询（如"我上个月学了什么前端知识"）。

### 4.7 版本历史 (Version History) 🆕

- **自动保存**: 每次编辑自动保存快照，最多保留 50 个版本。
- **历史回溯**: 查看任意历史版本的内容差异 (Diff View)。
- **一键恢复**: 可将笔记恢复到任意历史版本。
- **存储优化**: 仅存储增量差异，减少存储空间占用。

### 4.8 导入/导出 (Import/Export) 🆕

- **导出格式**:
  - Markdown (.md)
  - JSON (完整数据备份)
  - PDF (打印友好)
- **批量导出**: 支持按标签、时间范围批量导出。
- **导入支持**:
  - Markdown 文件/文件夹
  - Notion 导出的 Markdown
  - 简单 JSON 格式
- **自动备份**: 可设置每周自动导出完整备份到指定目录。

### 4.9 AI 深度伴生 (@goldierill)

- **被动响应**: 在评论区或者发帖的时候 `@goldierill`，AI 会根据当前模式（标准/RAG）进行回复。
- **主动行为**:
  - **隐形助手**: 用户发布笔记后，AI 会在后台默默工作，分析内容并打上合适的 `#标签`。
- **AI 增强功能** 🆕:
  - **一键摘要**: 选中长文后调用 `/ai summarize` 生成摘要。
  - **翻译助手**: `/ai translate [目标语言]` 翻译选中文本。
  - **扩写润色**: `/ai expand` 扩展简短想法为完整段落。
  - **问答模式**: 针对当前笔记内容提问 `/ai ask [问题]`。

### 4.10 聚焦模式 (Focus Mode) 🆕

- **功能**: 隐藏侧边栏和所有干扰元素，仅显示编辑区域。
- **启用方式**: 点击编辑器右上角按钮。
- **打字机模式**: 当前编辑行始终保持在屏幕中央。

### 4.11 AI 全局配置

支持热更新，无需重启服务：

- **总开关**: RAG Enable / Auto-Tag Enable / Daily Briefing Enable。
- **模型参数**: Base URL, API Key, Model Name。
- **记忆范围**: 设定 RAG 检索的时间窗口（如"只检索 2025 年的数据"）。
- **AI 人设配置** 🆕: 自定义 AI 助手的性格、语气和专业领域偏好。
- **RAGFlow 配置热更新** 🆕: 随时更改 RAGFlow 服务地址、API Key、Chat ID 等，立即生效无需重启。

### 4.12 实时多端同步 (Realtime Sync) 🆕

类似 Google Docs 的实时协作体验：

- **自动同步**: 用户在一个设备（如手机）编辑，停止输入 5 秒后自动同步到其他设备（如电脑）
- **编辑模式检测**: 只有进入编辑模式的设备才会接收同步更新
- **同一话题限制**: 只有打开同一条消息的设备之间才会同步
- **冲突处理**: 采用"最后写入优先"策略，避免复杂的冲突合并
- **状态指示**: UI 显示同步状态（同步中/已同步/编辑中）

---

## 5. 双模 AI 策略与自动化体系

### 5.1 数据同步 (Always On)

即使 AI 功能被关闭，新产生的笔记依然会实时推送到 RAGFlow 进行索引，确保未来启用 AI 时，知识库是最新的。

### 5.2 模式 A：标准模式 (Fast Thinking)

- **机制**: 直接连接 OpenAI 兼容接口。
- **用途**: 闲聊、简单的文本处理、翻译、润色。不具备长期记忆，仅依赖当前对话上下文。

### 5.3 模式 B：RAG 模式 (Slow Thinking)

- **机制**: 查询 -> RAGFlow 检索向量库 -> 注入上下文 -> LLM 回答。
- **用途**: 询问"我以前关于 React 的笔记写了什么？"、"总结我去年的读书心得"。

### 5.4 模式 C：后台守护者 (Background Agents)

这是一组不可见的 AI Worker，负责维护秩序：

1. **标签整理员**: 监听新笔记 -> 提取关键词 -> 写入标签库。
2. **日报编辑**: 每日定时 -> 检索昨日数据 -> 归纳总结 -> 发布内容。
3. **链接发现者** 🆕: 分析新笔记内容 -> 发现与已有笔记的潜在关联 -> 建议创建双向链接。

---

## 6. 数据库设计 (Prisma Schema)

这是系统的核心数据结构，包含了标签系统、双向链接、模板等功能。

```prisma
// --------------------------------------
// 1. 用户与基础信息
// --------------------------------------
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String?
  avatar        String?
  createdAt     DateTime  @default(now())

  // 关系
  messages      Message[]
  comments      Comment[]
  templates     Template[]
  aiConfig      AiConfig?  // 每用户独立的 AI 配置
}

// --------------------------------------
// 2. 核心内容模型 (支持 Thread、Tag、Link)
// --------------------------------------
model Message {
  id        String   @id @default(cuid())
  title     String?  // 🆕 笔记标题 (与 Alias 配合使用)
  content   String   @db.Text // 支持 Markdown 和长文本
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 收藏与置顶
  isStarred Boolean  @default(false)
  isPinned  Boolean  @default(false)

  // 关系
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String

  // 串 (Thread) 模式支持
  parentId  String?  // 指向父消息，为空则是根消息
  parent    Message? @relation("Thread", fields: [parentId], references: [id])
  children  Message[] @relation("Thread")

  // 标签系统
  tags      MessageTag[]

  // 版本历史
  versions  MessageVersion[]

  // 媒体与评论
  medias    Media[]
  comments  Comment[]
}

// --------------------------------------
// 3. 标签系统 (多对多)
// --------------------------------------
model Tag {
  id        String       @id @default(cuid())
  name      String       @unique // 例如 "React", "Idea", "Journal"
  color     String?      // 标签颜色 (可选)
  createdAt DateTime     @default(now())
  messages  MessageTag[]
}

model MessageTag {
  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  messageId String
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId     String

  @@id([messageId, tagId])
}

// --------------------------------------
// 4. 版本历史
// --------------------------------------
model MessageVersion {
  id        String   @id @default(cuid())
  content   String   @db.Text
  createdAt DateTime @default(now())

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  messageId String

  @@index([messageId, createdAt])
}

// --------------------------------------
// 5. 模板系统
// --------------------------------------
model Template {
  id          String   @id @default(cuid())
  name        String
  content     String   @db.Text
  description String?
  isBuiltIn   Boolean  @default(false) // 是否为系统内置模板
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  author      User?    @relation(fields: [authorId], references: [id])
  authorId    String?
}

// --------------------------------------
// 8. 评论与 AI 回复
// --------------------------------------
model Comment {
  id        String   @id @default(cuid())
  content   String   @db.Text
  createdAt DateTime @default(now())

  // 区分是用户评论还是 AI 生成的回复
  isAIBot   Boolean  @default(false)

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  messageId String
  author    User?    @relation(fields: [authorId], references: [id])
  authorId  String?
}

// --------------------------------------
// 9. 媒体资源
// --------------------------------------
model Media {
  id          String   @id @default(cuid())
  url         String
  type        String   // IMAGE, VIDEO, AUDIO
  description String?  // AI 生成的描述 (Vision)
  
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  messageId   String
}

// --------------------------------------
// 10. AI 系统动态配置 (每用户独立)
// --------------------------------------
model AiConfig {
  id             String   @id @default(cuid())

  // --- 用户关联 (多租户隔离) ---
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId         String   @unique  // 每个用户只有一条配置

  // --- 基础连接 ---
  openaiBaseUrl  String   @default("http://localhost:4000")
  openaiApiKey   String   @default("")
  openaiModel    String   @default("gpt-3.5-turbo")

  // --- RAG 模式 ---
  enableRag      Boolean  @default(false)
  ragflowBaseUrl String   @default("http://localhost:4154")
  ragflowApiKey  String   @default("")
  ragflowChatId  String   @default("")
  ragflowDatasetId String @default("")
  ragTimeFilterStart DateTime?
  ragTimeFilterEnd   DateTime?

  // --- 自动化配置 ---
  enableAutoTag  Boolean  @default(true)
  autoTagModel   String   @default("gpt-3.5-turbo") // 🆕 自动打标专用模型

  // --- AI 人设 ---
  aiPersonality  String   @default("friendly") // friendly, professional, casual
  aiExpertise    String?  // 专业领域偏好

  // --- 链接建议 ---
  enableLinkSuggestion Boolean @default(true)

  updatedAt      DateTime @updatedAt
}

// --------------------------------------
// 11. 搜索历史 (新增)
// --------------------------------------
model SearchHistory {
  id        String   @id @default(cuid())
  query     String
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

---

## 7. 关键业务逻辑描述

### 7.1 配置加载器逻辑 (Config Loader)

系统采用**用户级别配置**来管理 AI 设置，实现多租户隔离。在任何需要 AI 配置的操作前，系统会根据当前用户 ID 查询其专属的 `AiConfig` 记录。如果该用户尚无配置记录，则自动创建一条包含默认值（如 localhost 地址、RAG 关闭、自动打标开启）的记录并返回。这确保了：
- **隐私隔离**：每个用户可使用自己的 API Key
- **个性化配置**：AI 人设、RAGFlow 配置等互不干扰
- **成本分离**：各用户独立承担 API 调用费用

### 7.2 AI 响应主逻辑 (Main Interaction)

当用户在评论区触发 AI 时，后端处理流程如下：

1. **加载配置**：读取数据库中的最新 AI 设置。
2. **构建上下文**：获取当前 Message 及其所有历史评论，构建对话线程。
3. **模式分支判断**：
   - **若启用 RAG**：系统会先构建一个包含时间范围过滤器的查询请求，发送给 RAGFlow 引擎。RAGFlow 返回相关的知识片段后，这些片段被拼接到 Prompt 中，最后送入 LLM 生成回答。
   - **若禁用 RAG**：直接初始化 OpenAI 客户端，将对话线程作为 Messages 数组发送给 LLM。
4. **结果存储**：AI 的回答生成后，会被标记为 `isAIBot: true` 并作为一条新评论存入数据库。

### 7.3 后台自动打标流程 (Auto-Tagging Worker)

这是一个异步的后台任务，旨在不阻塞用户发帖体验：

1. **触发**：每当有新 `Message` 被创建，且配置中 `enableAutoTag` 为真，任务被推入队列。
2. **分析**：Worker 进程调用轻量级 LLM 模型，Prompt 要求其"分析文本内容，提取 1-3 个核心英文或中文 Hashtag，并以 JSON 数组格式返回"。
3. **写入**：解析返回的 JSON，遍历标签数组。系统使用 `upsert` 逻辑：如果标签已存在 `Tag` 表中，则直接关联；如果不存在，则先创建标签再关联。

### 7.4 版本历史保存流程 (Version Control) 🆕

1. **触发条件**：笔记内容发生变化且距离上次保存超过 30 秒。
2. **增量存储**：计算内容差异 (diff)，仅存储变化部分以节省空间。
3. **版本清理**：当版本数超过 50 时，自动删除最旧的版本（保留创建时的第一个版本）。

### 7.5 知识图谱数据构建 (Graph Builder) 🆕

1. **节点收集**：查询所有 Message、Comment 和 Tag 作为图节点。
2. **边构建**：
   - Message -> Tag：来自 `MessageTag` 关联。
   - Message -> Message：来自 `parentId`（串式回复）和 `quotedMessageId`（引用）关系。
   - Comment -> Message：评论与消息的关联。
   - Comment -> Comment：嵌套回复关系（`parentId`）。
3. **权重计算**：根据链接数量和最近访问时间计算节点权重，用于可视化时的节点大小。
4. **增量更新**：当笔记或标签变化时，仅更新受影响的局部图数据。