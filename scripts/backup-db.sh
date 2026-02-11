#!/bin/bash
# PostgreSQL 数据库备份脚本
# 使用方法: ./scripts/backup-db.sh

set -e

# 生成备份文件名
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/whitenote_backup_${TIMESTAMP}.sql"

# 确保备份目录存在
mkdir -p "$BACKUP_DIR"

# 执行备份（pg_dump 直接写入文件）
docker exec pg16 pg_dump -U myuser -d whitenote \
  --no-owner \
  --no-acl \
  --encoding=UTF8 \
  > "$BACKUP_FILE"

echo "✅ 备份完成: $BACKUP_FILE"

# 显示文件大小
ls -lh "$BACKUP_FILE" | awk '{print "文件大小: " $5}'
