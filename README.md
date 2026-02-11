# WhiteNote

WhiteNote 是一个协作式社交媒体平台，集成了 AI 增强功能，结合了 Twitter/X 风格的微博、工作区组织和实时协作。

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
