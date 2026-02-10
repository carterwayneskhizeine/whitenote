# Whitenote Docker 部署指南

## 概述

本项目支持 Docker 化部署，包含以下服务：
- **app**: Next.js 主应用
- **worker**: 后台任务处理器 (BullMQ)
- **postgres**: PostgreSQL 数据库
- **redis**: Redis 缓存和队列
- **pgadmin**: 数据库管理界面 (可选)

## 快速开始

### 1. 环境准备

确保已安装 Docker 和 Docker Compose。

### 2. 创建数据目录

```bash
mkdir -p data/uploads data/link_md
```

### 3. 配置环境变量

复制示例配置文件：

```bash
# Windows 开发环境
copy .env.docker.example .env

# Linux/Mac
# cp .env.docker.example .env
```

编辑 `.env` 文件，设置以下必需的环境变量：

```env
# 必需配置
NEXTAUTH_SECRET=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key=

# AI 服务 (如果使用)
OPENAI_BASE_URL=http://host.docker.internal:4000
OPENAI_API_KEY=your-openai-api-key

# RAGFlow (如果使用)
RAGFLOW_BASE_URL=http://host.docker.internal:4154
RAGFLOW_API_KEY=your-ragflow-api-key
```

### 4. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 或者使用 pnpm 脚本
pnpm docker:up
```

### 5. 访问应用

- **主应用**: http://localhost:3005
- **pgAdmin**: http://localhost:5050 (admin@whitenote.com / admin)

## 常用命令

```bash
# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f app

# 停止服务
docker-compose down

# 停止并删除数据卷 (谨慎使用)
docker-compose down -v

# 重建镜像
docker-compose build --no-cache

# 进入容器
docker-compose exec app sh

# 执行数据库迁移
docker-compose exec app npx prisma migrate deploy

# 查看数据库
docker-compose exec postgres psql -U myuser -d whitenote
```

## 目录结构

```
data/
├── uploads/        # 上传的文件
└── link_md/        # Markdown 文件同步目录
```

这些目录通过卷挂载持久化到宿主机。

## 跨平台注意事项

### Windows 开发

在 Windows 上开发时，如果不想使用 Docker，可以直接使用本地环境：

```bash
# 安装依赖
pnpm install

# 生成 Prisma Client
pnpm db:generate

# 启动数据库 (Docker)
docker-compose up -d postgres redis

# 运行迁移
pnpm db:migrate

# 启动开发服务器
pnpm dev

# 启动 Worker (另一个终端)
pnpm worker
```

### Linux/服务器部署

在 Linux 服务器上，使用完整的 Docker Compose 配置：

```bash
# 克隆项目
git clone <repo-url>
cd whitenote

# 配置环境变量
cp .env.docker.example .env
# 编辑 .env 文件

# 创建数据目录
mkdir -p data/uploads data/link_md

# 启动服务
docker-compose up -d
```

## 网络配置

### 访问宿主机的服务

如果 RAGFlow 或 OpenAI 服务运行在宿主机上，使用 `host.docker.internal`:

```env
OPENAI_BASE_URL=http://host.docker.internal:4000
RAGFLOW_BASE_URL=http://host.docker.internal:4154
```

### Linux 上的 host.docker.internal

在 Linux 上，需要确保 Docker 支持 host-gateway。在 `docker-compose.yml` 中添加：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## 故障排除

### 数据库连接失败

1. 检查 PostgreSQL 是否启动：
   ```bash
   docker-compose ps
   ```

2. 检查数据库 URL 是否正确：
   ```bash
   docker-compose logs postgres
   ```

### Worker 不处理任务

1. 检查 Redis 连接：
   ```bash
   docker-compose logs worker
   ```

2. 重启 Worker：
   ```bash
   docker-compose restart worker
   ```

### 文件上传失败

1. 检查 uploads 目录权限：
   ```bash
   ls -la data/uploads
   ```

2. 确保目录存在：
   ```bash
   mkdir -p data/uploads
   ```

## 生产环境优化

### 1. 使用外部数据库

在生产环境中，建议使用外部的托管数据库服务：

```env
DATABASE_URL=postgresql://user:pass@your-db-host:5432/whitenote
```

### 2. 配置反向代理

使用 Nginx 或 Traefik 作为反向代理，配置 HTTPS。

### 3. 配置环境变量

确保设置安全的密钥：

```env
NODE_ENV=production
NEXTAUTH_SECRET=<your-secure-secret>
ENCRYPTION_KEY=<your-secure-encryption-key>
```

### 4. 日志管理

配置 Docker 日志驱动：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## 备份和恢复

### 备份数据

```bash
# 备份数据库
docker-compose exec postgres pg_dump -U myuser whitenote > backup.sql

# 备份上传文件
tar -czvf uploads-backup.tar.gz data/uploads

# 备份 Markdown 文件
tar -czvf link_md-backup.tar.gz data/link_md
```

### 恢复数据

```bash
# 恢复数据库
docker-compose exec -T postgres psql -U myuser whitenote < backup.sql

# 恢复文件
tar -xzvf uploads-backup.tar.gz
tar -xzvf link_md-backup.tar.gz
```
