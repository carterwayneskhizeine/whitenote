# WhiteNote 2.5 后端开发指南 - Stage 1: 项目初始化

> **前置文档**: [产品设计文档](file:///d:/Code/WhiteNote/docs/PRODUCT_DESIGN_V2.5.md)  
> **下一步**: [Stage 2: 数据库 Schema](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_02_DATABASE.md)

---

## 目标

完成 Next.js 16 项目初始化，配置 TypeScript、Prisma ORM 和 PostgreSQL 连接。

---

## 环境要求

| 依赖 | 版本 | 安装方式 |
|------|------|----------|
| Node.js | >= v22.18.0 | [官网下载](https://nodejs.org/) |
| pnpm | >= 8.x | `npm install -g pnpm` |
| PostgreSQL | 16.x | Docker |

---

## Step 1: 创建 Next.js 项目

```bash
# 进入工作目录
cd d:\Code\WhiteNote

# 使用 pnpm 创建 Next.js 16 项目 (App Router)
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

> [!NOTE]
> 如果目录非空，选择覆盖现有文件。

---

## Step 2: 安装核心依赖

```bash
# Prisma ORM
pnpm add prisma @prisma/client

# NextAuth.js 认证
pnpm add next-auth @auth/prisma-adapter

# UI 组件库
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# 开发依赖
pnpm add -D @types/node
```

---

## Step 3: 初始化 Prisma

```bash
# 初始化 Prisma (PostgreSQL)
pnpm prisma init --datasource-provider postgresql
```

这将生成：
- `prisma/schema.prisma` - 数据库模型文件
- `.env` - 环境变量文件

---

## Step 4: 配置环境变量

编辑 `.env` 文件：

```env
# ========================================
# 数据库连接
# ========================================
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/whitenote?schema=public"

# ========================================
# NextAuth 配置
# ========================================
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"

# ========================================
# AI 服务配置 (可选，后续阶段使用)
# ========================================
OPENAI_BASE_URL="http://localhost:4000"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-3.5-turbo"

# ========================================
# RAGFlow 配置
# ========================================
RAGFLOW_BASE_URL="http://localhost:4154"
RAGFLOW_API_KEY="ragflow-61LVcg1JlwvJPHPmDLEHiw5NWfG6-QUvWShJ6gcbQSc"
RAGFLOW_CHAT_ID="1c4db240e66011f09080b2cef1c18441"
RAGFLOW_DATASET_ID="96b74969e65411f09f5fb2cef1c18441"
```

> [!WARNING]
> 请将 `your_password` 替换为你的 PostgreSQL 密码。`NEXTAUTH_SECRET` 可使用 `openssl rand -base64 32` 生成。

---

## Step 5: 项目目录结构

创建以下目录结构：

```
d:\Code\WhiteNote\
├── prisma/
│   └── schema.prisma       # 数据库模型 (Stage 2)
├── src/
│   ├── app/
│   │   ├── api/            # API Routes
│   │   │   ├── auth/       # NextAuth 端点
│   │   │   ├── messages/   # 消息 API
│   │   │   ├── tags/       # 标签 API
│   │   │   ├── comments/   # 评论 API
│   │   │   ├── templates/  # 模板 API
│   │   │   ├── search/     # 搜索 API
│   │   │   └── config/     # AI 配置 API
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── prisma.ts       # Prisma 客户端单例
│   │   ├── auth.ts         # NextAuth 配置
│   │   └── ragflow.ts      # RAGFlow API 封装
│   └── types/
│       └── index.ts        # 类型定义
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

创建目录命令：

```bash
# 创建 API 目录
mkdir -p src/app/api/auth
mkdir -p src/app/api/messages
mkdir -p src/app/api/tags
mkdir -p src/app/api/comments
mkdir -p src/app/api/templates
mkdir -p src/app/api/search
mkdir -p src/app/api/config

# 创建 lib 和 types 目录
mkdir -p src/lib
mkdir -p src/types
```

---

## Step 6: 创建 Prisma 客户端单例

创建 `src/lib/prisma.ts`：

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
```

> [!TIP]
> 单例模式避免在开发模式下由于热重载创建过多数据库连接。

---

## Step 7: 配置 TypeScript 路径别名

确认 `tsconfig.json` 包含以下配置：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Step 8: 创建环境变量示例文件

创建 `.env.example` 供团队参考：

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/whitenote?schema=public"
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET=""
OPENAI_BASE_URL=""
OPENAI_API_KEY=""
RAGFLOW_BASE_URL=""
RAGFLOW_API_KEY=""
RAGFLOW_CHAT_ID=""
RAGFLOW_DATASET_ID=""
```

---

## 验证检查点

完成本阶段后，执行以下验证：

```bash
# 1. 确认项目可以正常构建
pnpm build

# 2. 启动开发服务器
pnpm dev

# 3. 访问 http://localhost:3005 确认页面正常显示
```

---

## 常见问题

### Q: `pnpm create next-app` 报错

确保 Node.js 版本 >= v22.18.0，并更新 pnpm：

```bash
npm install -g pnpm@latest
```

### Q: PostgreSQL 连接失败

1. 确认 PostgreSQL 服务正在运行
2. 确认用户名密码正确
3. 确认数据库 `whitenote` 已创建：

```sql
CREATE DATABASE whitenote;
```

---

## 下一步

完成项目初始化后，继续 [Stage 2: 数据库 Schema](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_02_DATABASE.md)。
