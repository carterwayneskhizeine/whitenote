# WhiteNote

WhiteNote 是一个协作式社交媒体平台，集成了 AI 增强功能，结合了 Twitter/X 风格的微博、工作区组织和实时协作。

---

## 📖 项目功能详细介绍

WhiteNote 是一个功能丰富的 AI 增强型社交协作平台，类似于「第二大脑」的个人知识管理系统。它将 Twitter/X 的碎片化记录体验与 Notion 的结构化能力相结合，由双模 AI 驱动，支持实时多端同步编辑，旨在解决"记录压力大"与"回顾困难"的个人知识库痛点。

### 🏠 首页时间线 (Home Timeline)

首页是平台的核心信息流入口，展示用户发布的所有笔记（消息）：

- **混合时间线**：显示用户发布的所有根消息，按发布时间倒序排列
- **置顶功能**：用户可以将重要的笔记置顶，置顶的笔记会始终显示在时间线顶部
- **收藏功能**：用户可以收藏自己喜欢的笔记，方便之后快速查看
- **自动刷新**：发布新笔记后，时间线会自动刷新并滚动到顶部
- **实时同步**：利用 Socket.IO 实现多设备实时同步，在一个设备上发布的内容会即时出现在其他设备上
- **引用消息**：支持在帖子中引用（转发/引用）其他用户的帖子，展示原帖内容
- **快速导航**：支持通过 URL 参数 `?scrollto=<messageId>` 跳转到特定帖子并自动滚动聚焦

### ✍️ 发布功能 (Compose)

发布框是 WhiteNote 的核心输入入口，支持丰富的创作功能：

- **富文本编辑器**：基于 TipTap 构建的 Markdown 友好编辑器
  - 支持 **Slash Command (`/`)** 快捷指令菜单
  - 输入 `/` 可快速插入代码块、Todo 列表、分割线等元素
  - 支持 Markdown 语法实时渲染
  - 支持表格编辑（插入、编辑表格）
  - 支持代码高亮显示
- **媒体上传**：
  - 支持上传图片（自动压缩优化）
  - 支持上传视频
  - 拖拽上传或点击选择文件
  - 上传进度实时显示
- **模板调用**：内置丰富的消息模板，输入 `/template` 可快速调用
  - 📅 每日日记 (Daily Journal)
  - 💡 想法捕捉 (Quick Idea)
  - 自定义模板（用户可自行创建和管理）
- **语音转文字 (ASR)**：集成 SiliconFlow ASR API，支持语音输入
  - 点击麦克风图标开始录音
  - 录音完成后自动识别并转换为文字
  - 需要在设置中配置 ASR API Key
- **AI 增强**：
  - 输入框内置 AI 增强按钮，可以调用 AI 对内容进行润色、优化
  - 支持自定义 AI 命令（见 AI 命令功能）
- **工作区选择**：发布时可选择发布到哪个工作区
- **字符计数**：底部显示当前字符数
- **发布按钮**：支持发布根帖子（到时间线）或仅作为回复

### 💬 帖子详情页 (Status Page)

点击任意帖子进入详情页，展示完整的帖子内容和所有评论：

- **完整内容显示**：展示帖子的全部内容，支持长文本折叠显示
- **媒体展示**：
  - 图片支持网格布局显示
  - 点击图片可打开灯箱（Lightbox）全屏浏览
  - 支持图片放大、缩小、切换
- **引用展示**：如果帖子引用了其他帖子，底部会显示被引用的原帖卡片
- **评论列表**：显示该帖子下的所有评论，支持嵌套回复
- **操作按钮**：
  - 回复 (Reply)：打开回复对话框
  - 转发 (Retweet)：引用转发帖子到自己的时间线
  - 收藏 (Star)：收藏/取消收藏帖子
  - 分享 (Share)：生成分享链接
  - 复制 (Copy)：复制帖子内容到剪贴板
  - 更多 (More)：编辑、删除、置顶/取消置顶
- **时间显示**：显示精确的发布时间
- **作者信息**：显示发布者的头像、名称和标签

### 🧵 话题/回复链 (Thread & Replies)

WhiteNote 支持类似 Twitter 的串式回复系统：

- **回复功能**：每条帖子都可以有回复，形成讨论链
- **嵌套回复**：回复可以继续被回复，形成多层嵌套结构
- **回复计数**：帖子卡片上显示回复数量
- **回复通知**：有新回复时会收到通知
- **评论收藏**：不仅帖子可以收藏，评论也可以单独收藏
- **评论转发**：评论也可以被转发到时间线
- **评论删除**：评论作者可以删除自己的评论

### 🏷️ 标签系统 (Tags)

强大的标签系统帮助用户组织和发现内容：

- **自动标签**：AI 会自动分析帖子内容并添加合适的标签
- **手动标签**：发布时可以手动添加标签（输入 `#标签名`）
- **标签图谱**：在 Tags 页面以可视化的知识图谱展示所有标签和它们之间的关系
  - 节点：标签（方形节点）
  - 边：标签与帖子之间的关联关系
  - 交互：点击节点可查看该标签下的所有帖子
- **热门标签**：右侧边栏显示当前最热门的标签
- **标签搜索**：支持按标签搜索相关帖子
- **标签颜色**：每个标签可以设置不同的颜色

### 📊 知识图谱 (Knowledge Graph)

WhiteNote 内置交互式知识图谱可视化：

- **全局图谱**：在 Tags 页面展示所有笔记和标签的关系网络
- **图谱节点**：
  - 圆形节点：代表帖子/消息
  - 方形节点：代表标签
- **图谱边**：
  - 蓝色实线：回复关系
  - 蓝色虚线：引用关系
  - 蓝色粗线：转发关系
  - 白色实线：评论关系
  - 白色虚线：评论回复关系
- **交互功能**：
  - 点击节点跳转到对应帖子
  - 拖拽节点调整布局
  - 缩放和平移浏览
  - 鼠标悬停显示节点信息
- **D3.js 实现**：使用 D3.js 力导向图实现流畅的图谱渲染

### ⭐ 收藏功能 (Favorites)

收藏功能帮助用户保存重要的内容：

- **帖子收藏**：收藏喜欢的帖子
- **评论收藏**：收藏重要的评论
- **收藏列表**：专门的收藏页面展示所有收藏的内容
- **收藏统计**：显示收藏总数

### 🔍 搜索功能 (Search)

强大的搜索系统帮助用户快速找到内容：

- **全文搜索**：基于 PostgreSQL 全文索引，毫秒级响应
- **搜索历史**：记录最近搜索记录，支持一键重用
- **搜索建议**：输入时实时显示搜索建议
- **过滤功能**：
  - 按标签过滤：`tag:#React`
  - 按时间范围过滤
  - 按媒体类型过滤（图片、代码等）
  - 按收藏状态过滤
- **桌面端**：右侧边栏集成搜索框
- **移动端**：顶部导航栏提供搜索入口

### 🤖 AI 聊天 (AI Chat)

WhiteNote 深度集成 OpenClaw AI 助手：

- **独立聊天页面**：专门的 AI 聊天界面 (`/aichat`)
- **会话管理**：支持多个聊天会话
  - 创建新会话
  - 切换不同会话
  - 命名会话
- **流式响应**：AI 回复采用流式输出，体验更自然
- **上下文感知**：AI 可以访问用户的知识库（RAG 模式）
- **移动端适配**：
  - 键盘弹出时自动调整布局
  - 适配移动端视口高度变化
  - 支持语音输入

### 🔐 分享功能 (Share)

公开分享你的内容给任何人：

- **帖子分享**：生成分享链接，任何人无需登录即可查看
- **评论分享**：也可以单独分享评论
- **公开访问**：分享链接采用公开 API，无需认证即可访问
- **沙箱模式**：访客只能查看内容，无法进行交互操作（评论、点赞等）
- **复制链接**：一键复制分享链接
- **访问分享页**：点击链接可直接在浏览器中查看分享的内容

### 📝 模板系统 (Templates)

模板系统帮助用户快速创建标准化格式的内容：

- **内置模板**：预装常用模板
  - 📅 每日日记 (Daily Journal)
  - 💡 想法捕捉 (Quick Idea)
- **自定义模板**：用户可以创建自己的模板
  - 模板名称
  - 模板内容（支持 Markdown）
  - 模板描述
- **模板管理页面**：专门的模板管理界面 (`/templates`)
  - 创建新模板
  - 编辑模板
  - 删除模板
  - 内置模板不可删除
- **调用方式**：在发布框输入 `/template [模板名]`

### ⚙️ 设置页面 (Settings)

WhiteNote 提供完善的设置系统，分为多个设置子页面：

#### 👤 个人资料 (Profile)

- 修改显示名称
- 修改头像
- 修改邮箱
- 修改密码

#### 🏢 工作区管理 (Workspaces)

- **多工作区支持**：创建多个独立的工作区
- **工作区配置**：
  - 工作区名称
  - 工作区描述
  - 独立 AI 配置开关（自动打标、每日晨报）
- **RAGFlow 集成**：
  - 初始化 RAGFlow 知识库
  - 同步数据到 RAGFlow
  - 重置 RAGFlow 知识库
  - 查看 RAGFlow 连接状态
- **工作区切换**：侧边栏快速切换工作区

#### 🤖 AI 配置 (AI Configuration)

- **OpenAI 配置**：
  - API Base URL（支持自定义 OpenAI 兼容 API）
  - API Key
  - 模型选择（gpt-4o, gpt-3.5-turbo 等）
- **RAGFlow 配置**（知识库增强）：
  - 启用/禁用 RAG 模式
  - RAGFlow 服务地址
  - RAGFlow API Key
  - Chat ID 和 Dataset ID
  - 时间过滤范围（只检索特定时间段的数据）
- **ASR 配置**（语音识别）：
  - SiliconFlow ASR API 地址
  - ASR API Key
- **自动化配置**：
  - 自动标签：启用后 AI 自动为新帖子打标签
  - 自动打标模型选择
  - 每日晨报：启用后 AI 每天早上生成昨日回顾
  - 晨报生成模型选择
  - 晨报发布时间（默认 08:00）
- **AI 人设配置**：
  - AI 性格（friendly, professional, casual）
  - 专业领域偏好
- **链接建议**：启用后 AI 建议帖子之间的关联
- **Markdown 文件同步**：
  - 启用/禁用本地 Markdown 文件同步
  - 配置同步目录
- **配置测试**：测试 API 连接是否正常

#### 🪄 AI 命令 (AI Commands)

- **自定义 AI 指令**：创建和管理自定义 AI 命令
- **命令配置**：
  - 命令标签（显示名称）
  - 命令描述
  - 命令动作（action 类型）
  - Prompt 模板
- **预设命令**：内置常用 AI 命令
- **命令调用**：在发布框中通过快捷方式调用

#### 🎨 显示与外观 (Appearance)

- **深浅模式切换**：
  - 浅色模式
  - 深色模式
  - 跟随系统

#### 🔒 隐私与安全 (Privacy)

- **密码修改**：修改账户密码

#### 🌍 语言 (Language)

- **界面语言**：选择界面显示语言（当前支持中文）

#### 📖 帮助中心 (Help)

- **使用帮助**：获取使用指南和支持

### 📱 移动端与桌面端适配

WhiteNote 采用响应式设计，完美适配移动端和桌面端：

#### 桌面端 (Desktop)

- **左侧边栏**：固定导航栏，包含：
  - 首页 (Home)
  - Tags (标签图谱)
  - AI Chat (AI 聊天)
  - 收藏 (Favorites)
  - 更多 (更多选项)
  - 用户信息（头像、名称）
  - 发布按钮
- **右侧边栏**：
  - 搜索框
  - 搜索历史
  - 热门标签
- **中央内容区**：主时间线和内容展示

#### 移动端 (Mobile)

- **底部导航栏**：固定在底部的导航菜单
  - 首页
  - 搜索
  - 发布按钮（突出显示）
  - 收藏
  - 个人资料
- **自动隐藏**：滚动时导航栏自动隐藏，显示内容更多
- **键盘适配**：键盘弹出时自动调整布局
- **触摸优化**：所有交互元素都针对触摸操作优化
- **移动端路由**：部分操作在移动端会导航到独立页面（如回复、转发）

### 🔄 实时同步 (Realtime Sync)

基于 Socket.IO 和 Redis Pub/Sub 的实时同步系统：

- **多设备同步**：在一个设备上的操作会实时同步到其他设备
- **自动同步**：编辑后 5 秒自动同步
- **冲突处理**：采用"最后写入优先"策略
- **状态指示**：UI 显示同步状态
- **同话题同步**：只有打开同一条消息的设备之间才会同步

### 🔔 其他功能

- **图片灯箱**：点击图片全屏浏览，支持缩放和切换
- **视频播放**：集成视频播放器
- **时间显示**：相对时间显示（如"3分钟前"）
- **加载状态**：所有数据加载显示加载动画
- **错误处理**：网络错误时显示友好的错误提示
- **确认对话框**：删除等危险操作需要二次确认

---

## 🚀 快速开始

### 前置要求

- Docker 和 Docker Compose
- Node.js 20+ 和 pnpm（仅本地开发需要）
- PostgreSQL 数据库（通过 Docker 提供）

## 🐳 Docker 部署

### 生产模式

**生产模式**使用优化的 standalone 构建，适合部署到生产环境。

```bash
# 1. 构建生产镜像
pnpm docker:build

# 2. 启动所有服务（包括 PostgreSQL、Redis、App、Worker）
pnpm docker:prod

# 或者直接使用 docker-compose 命令
docker compose -f docker-compose.yml up -d
```

生产模式包含以下服务：
- **PostgreSQL** (端口 5925) - 主数据库
- **pgAdmin** (端口 5050) - 数据库管理界面
- **Redis** (端口 16379) - 缓存和消息队列
- **WhiteNote App** (端口 3005) - 主应用服务器
- **WhiteNote Worker** - 后台任务处理器

### 开发模式

**开发模式**支持热重载，代码修改会自动更新，无需重新构建。

```bash
# 1. 首次启动需要构建开发镜像（包含所有开发依赖）
pnpm docker:dev:build

# 2. 启动开发环境
pnpm docker:dev

# 或者直接使用 docker compose 命令
docker compose -f docker compose.dev.yml up -d
```

开发模式特点：
- ✅ **热重载** - 修改 `src/`、`components/`、`lib/` 等目录下的代码会自动更新
- ✅ **TypeScript 路径别名** - 支持 `@/` 别名解析
- ✅ **完整开发工具** - 包含 TypeScript、ESLint 等开发工具
- 📝 **日志查看** - 使用 `pnpm docker:dev:logs` 查看所有服务日志

### 常用 Docker 命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
pnpm docker:dev:logs        # 开发环境
pnpm docker:logs            # 生产环境

# 停止服务
pnpm docker:dev:down        # 停止开发环境
pnpm docker:down            # 停止生产环境

# 重启服务
pnpm docker:dev:down && pnpm docker:dev
```

### 依赖更新

**生产模式**：修改 `package.json` 或 `pnpm-lock.yaml` 后需要重新构建
```bash
pnpm docker:build
```

**开发模式**：同样的，修改依赖文件后需要重新构建开发镜像
```bash
pnpm docker:dev:build
```

## 💻 本地开发（非 Docker）

如果你不想使用 Docker，可以直接在本地运行：

```bash
# 1. 安装依赖
pnpm install

# 2. 启动 PostgreSQL 和 Redis（使用 Docker）
docker compose up -d postgres redis

# 3. 推送数据库 schema
pnpm prisma db push

# 4. 运行种子脚本（创建内置模板和 AI 命令）
pnpm prisma db seed

# 5. 构建 Next.js（必须先执行）
pnpm build

# 6. 终端 1：启动开发服务器
pnpm dev

# 7. 终端 2：启动后台 Worker
pnpm worker
```

访问 [http://localhost:3005](http://localhost:3005) 查看应用。

## 🗄️ 数据库管理

### 重置数据库

⚠️ **警告**：以下操作会永久删除所有数据，请先备份重要数据。

```bash
# 1. 删除现有数据库
docker exec pg16 psql -U myuser -d postgres -c "DROP DATABASE IF EXISTS whitenote;"

# 2. 创建新数据库
docker exec pg16 psql -U myuser -d postgres -c "CREATE DATABASE whitenote;"

# 3. 推送 Prisma schema
pnpm prisma db push

# 4. 运行种子脚本
pnpm prisma db seed
```

### 常用数据库操作

```bash
# 推送 schema 变更到数据库
pnpm prisma db push

# 运行种子脚本
pnpm prisma db seed

# 打开 Prisma Studio（数据库管理 UI）
pnpm prisma studio

# 生成 Prisma Client
pnpm prisma generate
```

## 🔧 环境变量

创建 `.env` 文件配置以下环境变量：

```bash
# 数据库
DATABASE_URL="postgresql://myuser:mypassword@postgres:5432/whitenote?schema=public"

# Redis
REDIS_URL="redis://redis:6379"

# NextAuth
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="your-secret-key-here"

# AI 配置
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4"

# RAGFlow（可选）
RAGFLOW_BASE_URL="https://your-ragflow-instance.com"
RAGFLOW_API_KEY="your-ragflow-api-key"

# 文件上传
UPLOAD_DIR="/app/data/uploads"
FILE_WATCHER_DIR="/app/data/link_md"
FILE_WATCHER_ENABLED="true"
```

## 📂 项目结构

```
src/
├── app/                    # Next.js App Router 页面
├── components/             # React 组件
├── lib/                    # 工具库和配置
│   ├── ai/                # AI 集成
│   ├── queue/             # BullMQ 队列
│   └── socket/            # Socket.IO 配置
├── store/                  # Zustand 状态管理
├── hooks/                  # 自定义 React Hooks
└── types/                  # TypeScript 类型定义

scripts/
└── worker.ts              # 后台任务处理器

prisma/
├── schema.prisma          # 数据库 schema
└── seed-ai-commands.ts   # AI 命令种子脚本
```

## 🔍 故障排查

### 开发模式 404 错误

如果开发模式下遇到 404 或模块找不到错误：

1. 确保已构建开发镜像：`pnpm docker:dev:build`
2. 检查是否挂载了 `tsconfig.json`：`docker exec whitenote-app-dev ls -la /app/tsconfig.json`
3. 查看应用日志：`pnpm docker:dev:logs`

### 路径别名错误

如果看到 `Cannot find module '@/xxx'` 错误：

- 开发模式已配置 `tsconfig-paths` 支持 `@/` 别名
- 确保容器内有 `tsconfig.json` 文件
- 重启容器：`pnpm docker:dev:down && pnpm docker:dev`

### 数据库连接失败

检查 PostgreSQL 是否运行：
```bash
docker-compose ps postgres
docker logs pg16
```

### 构建错误：Module not found

如果运行 `pnpm build` 时出现 `Module not found` 错误（如 `@auth/prisma-adapter`、`@prisma/client`、`@radix-ui/react-*` 等）：

```bash
# 1. 删除已损坏的依赖和构建缓存
rm -rf node_modules .next

# 2. 重新安装依赖
pnpm install

# 3. 重新生成 Prisma Client
pnpm prisma generate

# 4. 重新构建
pnpm build
```

此问题通常发生在：
- 首次克隆项目后未生成 Prisma Client
- `node_modules` 依赖损坏或不完整
- 升级了 Prisma 或相关依赖后

## 📚 更多资源

- [Next.js 文档](https://nextjs.org/docs)
- [Prisma 文档](https://www.prisma.io/docs)
- [Socket.IO 文档](https://socket.io/docs/v4/)
- [BullMQ 文档](https://docs.bullmq.io/)
