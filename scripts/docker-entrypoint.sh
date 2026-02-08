#!/bin/sh
set -e

echo "[Docker Entrypoint] Starting Whitenote..."

# 等待数据库就绪
echo "[Docker Entrypoint] Waiting for database..."
until PGPASSWORD="${POSTGRES_PASSWORD:-mypassword}" psql -h postgres -U "${POSTGRES_USER:-myuser}" -d "${POSTGRES_DB:-whitenote}" -c "SELECT 1;" > /dev/null 2>&1; do
  echo "[Docker Entrypoint] Database is unavailable - sleeping"
  sleep 1
done
echo "[Docker Entrypoint] Database is ready!"

# 部署数据库迁移
echo "[Docker Entrypoint] Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "[Docker Entrypoint] Migration failed, trying db push..."
  npx prisma db push --skip-generate
fi

# 生成 Prisma Client (以防万一)
echo "[Docker Entrypoint] Generating Prisma Client..."
npx prisma generate

# 启动应用
echo "[Docker Entrypoint] Starting application..."
exec "$@"
