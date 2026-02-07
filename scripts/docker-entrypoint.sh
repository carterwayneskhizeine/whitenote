#!/bin/sh
set -e

echo "[Docker Entrypoint] Starting Whitenote..."

# 等待数据库就绪
echo "[Docker Entrypoint] Waiting for database..."
until npx prisma db execute --url "${DATABASE_URL}" --stdin <<< "SELECT 1;" > /dev/null 2>&1; do
  echo "[Docker Entrypoint] Database is unavailable - sleeping"
  sleep 1
done
echo "[Docker Entrypoint] Database is ready!"

# 部署数据库迁移
echo "[Docker Entrypoint] Running database migrations..."
npx prisma migrate deploy

# 生成 Prisma Client (以防万一)
echo "[Docker Entrypoint] Generating Prisma Client..."
npx prisma generate

# 启动应用
echo "[Docker Entrypoint] Starting application..."
exec "$@"
