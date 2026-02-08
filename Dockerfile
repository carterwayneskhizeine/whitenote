# ========================================
# Whitenote Docker 构建文件
# ========================================

# 阶段 1: 依赖安装
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 生成 Prisma Client
RUN npx prisma generate

# 阶段 2: 构建应用
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=deps /app/prisma ./prisma

# 复制源代码
COPY . .

# 构建 Next.js 应用
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# 阶段 3: 运行应用
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache ffmpeg postgresql-client

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安装 pnpm（用于运行时安装 Prisma CLI）
RUN corepack enable && corepack prepare pnpm@latest --activate

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 创建数据目录并设置权限
RUN mkdir -p /app/data/uploads /app/data/link_md
RUN chown -R nextjs:nodejs /app/data

# 从 builder 复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制 Prisma 相关文件
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Note: .prisma directory might not exist in standalone build, skipping

# 复制 package.json 和 pnpm-lock.yaml 用于安装 Prisma CLI
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/pnpm-lock.yaml ./

# 安装 Prisma CLI 和 dotenv（运行时需要执行迁移）
RUN pnpm add -D prisma dotenv

# 复制启动脚本
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 修复 node_modules 权限（因为 pnpm add 以 root 运行）
RUN chown -R nextjs:nodejs /app/node_modules

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3005

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 设置入口点
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# 启动命令
CMD ["node", "server.js"]
