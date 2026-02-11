# 数据库备份指南

备份 WhiteNote Docker 数据库，防止数据丢失。

## 备份重要性

✅ **防止数据丢失**：硬件故障、误操作、数据库损坏
✅ **快速恢复**：减少停机时间
✅ **版本控制**：保留历史数据快照
✅ **迁移便利**：方便在不同服务器间迁移

## 方法一：使用 pg_dump（推荐）

### 完整备份

```bash
# 创建备份目录
mkdir -p D:\Code\whitenote\backups

# 执行完整数据库备份
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl \
  > D:\Code\whitenote\backups\whitenote_backup_$(date +%Y%m%d_%H%M%S).sql

# Windows PowerShell 版本
# 设置输出编码
$env:PGCLIENTENCODING = "UTF8"
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "D:\Code\whitenote\backups\whitenote_backup_$timestamp.sql"

# 使用 PowerShell 7+ 的方式，或者使用重定向
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl --encoding=UTF8 2>&1 | Out-File -FilePath $backupFile -Encoding utf8NoBOM

```

```bash
cd D:\Code\whitenote
bash scripts/backup-db.sh
```

### 压缩备份

```bash
# 备份并压缩（节省空间）
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl \
  | gzip > D:\Code\whitenote\backups\whitenote_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 仅备份数据（不含结构）

```bash
# 只备份数据，不包含表结构定义
docker exec pg16 pg_dump -U myuser -d whitenote --data-only --no-owner --no-acl \
  > D:\Code\whitenote\backups\whitenote_data_$(date +%Y%m%d_%H%M%S).sql
```

### 仅备份结构（不含数据）

```bash
# 只备份表结构，不包含数据
docker exec pg16 pg_dump -U myuser -d whitenote --schema-only --no-owner --no-acl \
  > D:\Code\whitenote\backups\whitenote_schema_$(date +%Y%m%d_%H%M%S).sql
```

## 方法二：备份特定表

### 备份关键表

```bash
# 备份用户、消息、评论表
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl \
  -t "User" -t "Message" -t "Comment" -t "Workspace" \
  > D:\Code\whitenote\backups\whitenote_core_$(date +%Y%m%d_%H%M%S).sql
```

### 备份单个表

```bash
# 只备份消息表
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl \
  -t "Message" \
  > D:\Code\whitenote\backups\whitenote_messages_$(date +%Y%m%d_%H%M%S).sql
```

## 方法三：使用 Docker Volume 备份

### 备份整个数据卷

```bash
# 停止服务以确保数据一致性
docker-compose stop app worker

# 备份 PostgreSQL 数据卷
docker run --rm \
  -v whitenote_pg16_data:/data \
  -v D:\Code\whitenote\backups:/backup \
  alpine tar czf /backup/pg16_volume_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 重启服务
docker-compose start app worker
```

### 恢复 Volume 备份

```bash
# 停止服务
docker-compose down

# 删除现有卷（危险操作！）
docker volume rm whitenote_pg16_data

# 重新创建卷
docker volume create whitenote_pg16_data

# 恢复数据
docker run --rm \
  -v whitenote_pg16_data:/data \
  -v D:\Code\whitenote\backups:/backup \
  alpine tar xzf /backup/pg16_volume_20260208_184752.tar.gz -C /data

# 重启服务
docker-compose up -d
```

## 方法四：自动备份脚本

### 创建定时备份脚本

创建文件 `scripts/backup-database.sh`：

```bash
#!/bin/bash

# WhiteNote 数据库自动备份脚本

# 配置
BACKUP_DIR="D:/Code/whitenote/backups"
RETENTION_DAYS=30  # 保留最近 30 天的备份
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# 执行备份
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl \
  > "$BACKUP_DIR/whitenote_backup_$DATE.sql"

# 压缩备份
gzip "$BACKUP_DIR/whitenote_backup_$DATE.sql"

# 删除旧备份
find "$BACKUP_DIR" -name "whitenote_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed: whitenote_backup_$DATE.sql.gz"

# 可选：发送通知（需要配置邮件或 webhook）
# curl -X POST "$WEBHOOK_URL" -d "Backup completed successfully"
```

### 设置定时任务（Windows）

使用 Task Scheduler：

```powershell
# 创建 PowerShell 脚本 backup-database.ps1
$BackupDir = "D:\Code\whitenote\backups"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"

New-Item -ItemType Directory -Force -Path $BackupDir

Write-Host "[$(Get-Date)] Starting database backup..."

docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl `
  | Out-File -Encoding UTF8 "$BackupDir\whitenote_backup_$Date.sql"

Write-Host "[$(Get-Date)] Compressing backup..."
Compress-Archive -Path "$BackupDir\whitenote_backup_$Date.sql" `
  -DestinationPath "$BackupDir\whitenote_backup_$Date.zip" `
  -CompressionLevel Optimal

Remove-Item "$BackupDir\whitenote_backup_$Date.sql"

# 删除 30 天前的备份
Get-ChildItem $BackupDir -Filter "whitenote_backup_*.zip" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item

Write-Host "[$(Get-Date)] Backup completed: whitenote_backup_$Date.zip"
```

在 Task Scheduler 中创建每日任务：
- 触发器：每天凌晨 2:00
- 操作：启动 PowerShell
  ```
  powershell.exe -ExecutionPolicy Bypass -File "D:\Code\whitenote\scripts\backup-database.ps1"
  ```

### 设置定时任务（Linux/Mac）

```bash
# 编辑 crontab
crontab -e

# 添加每日凌晨 2:00 备份
0 2 * * * /path/to/whitenote/scripts/backup-database.sh >> /var/log/whitenote-backup.log 2>&1
```

## 方法五：使用 pgAdmin 备份

### 通过 pgAdmin Web 界面

1. 访问 pgAdmin：http://localhost:5050
2. 登录（默认：admin@whitenote.com / admin）
3. 在 Browser 中找到 `Servers > postgres > whitenote`
4. 右键点击 `whitenote` 数据库
5. 选择 `Backup...`
6. 配置备份选项：
   - **Filename**: 选择保存位置
   - **Format**: Plain 或 Custom
   - **Encoding**: UTF8
7. 点击 `Backup` 开始备份

## 备份验证

### 验证备份文件完整性

```bash
# 检查 SQL 文件是否包含数据
grep "COPY public" D:\Code\whitenote\backups\whitenote_backup_20260208_184752.sql | head -10

# 检查文件大小
ls -lh D:\Code\whitenote\backups\whitenote_backup_*.sql

# 统计表数量
grep "CREATE TABLE" D:\Code\whitenote\backups\whitenote_backup_20260208_184752.sql | wc -l
```

### 测试恢复（不覆盖现有数据）

```bash
# 创建测试数据库
docker exec pg16 psql -U myuser -d postgres -c "CREATE DATABASE whitenote_test;"

# 恢复到测试数据库
docker exec -i pg16 psql -U myuser -d whitenote_test \
  < D:\Code\whitenote\backups\whitenote_backup_20260208_184752.sql

# 验证数据
docker exec pg16 psql -U myuser -d whitenote_test -c "SELECT COUNT(*) FROM \"Message\";"

# 删除测试数据库
docker exec pg16 psql -U myuser -d postgres -c "DROP DATABASE whitenote_test;"
```

## 备份策略建议

### 3-2-1 备份原则

- **3 份副本**：1 份原始 + 2 份备份
- **2 种介质**：本地 + 云存储
- **1 份异地**：至少一份在远程位置

### 推荐备份计划

| 频率 | 类型 | 保留期 | 位置 |
|------|------|--------|------|
| 每日 | 增量备份 | 7 天 | 本地 |
| 每周 | 完整备份 | 4 周 | 本地 + 云 |
| 每月 | 完整备份 | 12 个月 | 异地 |

### 自动化备份流程

```bash
# 每日脚本（scripts/daily-backup.sh）
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/daily"

docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl \
  | gzip > "$BACKUP_DIR/whitenote_$DATE.sql.gz"

# 上传到云存储（示例：使用 rclone）
# rclone copy "$BACKUP_DIR/whitenote_$DATE.sql.gz" remote:whitenote-backups/daily/

# 删除 7 天前的本地备份
find $BACKUP_DIR -name "whitenote_*.sql.gz" -mtime +7 -delete
```

## 灾难恢复流程

### 场景 1：误删除数据

```bash
# 1. 立即停止应用服务
docker-compose stop app worker

# 2. 恢复最近的备份
docker exec -i pg16 psql -U myuser -d whitenote \
  < backups/whitenote_backup_20260208_184752.sql

# 3. 重启服务
docker-compose start app worker
```

### 场景 2：数据库损坏

```bash
# 1. 停止所有服务
docker-compose down

# 2. 删除损坏的数据库卷
docker volume rm whitenote_pg16_data

# 3. 重新创建卷
docker volume create whitenote_pg16_data

# 4. 启动数据库服务
docker-compose up -d postgres

# 5. 等待数据库就绪
docker exec pg16 pg_isready -U myuser -d whitenote

# 6. 恢复备份
docker exec -i pg16 psql -U myuser -d whitenote \
  < backups/whitenote_backup_20260208_184752.sql

# 7. 启动所有服务
docker-compose up -d
```

### 场景 3：迁移到新服务器

```bash
# 在旧服务器上：
# 1. 创建备份
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl \
  > whitenote_migration_backup.sql

# 2. 打包上传文件
tar czf whitenote_backup.tar.gz whitenote_migration_backup.sql data/

# 在新服务器上：
# 3. 解压文件
tar xzf whitenote_backup.tar.gz

# 4. 启动 Docker 服务
docker-compose up -d postgres

# 5. 等待数据库就绪
docker exec pg16 pg_isready -U myuser -d whitenote

# 6. 恢复数据
docker exec -i pg16 psql -U myuser -d whitenote \
  < whitenote_migration_backup.sql

# 7. 启动所有服务
docker-compose up -d
```

## 备份脚本模板

### 完整备份脚本

创建 `scripts/complete-backup.sh`：

```bash
#!/bin/bash
set -e

# 配置
PROJECT_DIR="D:/Code/whitenote"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否运行
if ! docker ps > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

# 创建备份目录
mkdir -p "$BACKUP_DIR"

log_info "Starting backup at $DATE"

# 1. 数据库备份
log_info "Backing up PostgreSQL database..."
DB_BACKUP="$BACKUP_DIR/whitenote_db_$DATE.sql"
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl > "$DB_BACKUP"

if [ $? -eq 0 ]; then
    log_info "✓ Database backup completed"
else
    log_error "✗ Database backup failed"
    exit 1
fi

# 2. 压缩备份
log_info "Compressing backup..."
gzip "$DB_BACKUP"
DB_BACKUP_GZ="$DB_BACKUP.gz"

# 3. 验证备份
if [ -f "$DB_BACKUP_GZ" ]; then
    SIZE=$(du -h "$DB_BACKUP_GZ" | cut -f1)
    log_info "✓ Backup created: $DB_BACKUP_GZ ($SIZE)"
else
    log_error "✗ Backup file not found"
    exit 1
fi

# 4. 清理旧备份
log_info "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "whitenote_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 5. 列出当前备份
log_info "Current backups:"
ls -lh "$BACKUP_DIR"/whitenote_db_*.sql.gz | tail -5

log_info "Backup completed successfully!"

# 可选：发送通知
# curl -X POST "$WEBHOOK_URL" -d "{\"content\":\"✅ WhiteNote backup completed: $DATE\"}"
```

### 恢复脚本

创建 `scripts/restore-database.sh`：

```bash
#!/bin/bash
set -e

# 配置
BACKUP_DIR="$PROJECT_DIR/backups"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lt "$BACKUP_DIR"/whitenote_db_*.sql.gz | head -10
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will replace the current database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Stopping services..."
docker-compose stop app worker

echo "Restoring database..."
gunzip -c "$BACKUP_FILE" | docker exec -i pg16 psql -U myuser -d whitenote

echo "Restarting services..."
docker-compose start app worker

echo "Restore completed!"
```

## 最佳实践

### ✅ DO

- **定期备份**：至少每天一次
- **验证备份**：定期测试恢复流程
- **异地存储**：使用云存储（AWS S3, Google Drive, 等）
- **加密备份**：敏感数据加密存储
- **文档化**：记录备份和恢复流程
- **监控**：设置备份失败告警

### ❌ DON'T

- **不要只依赖单一备份**：至少保留 3 个版本
- **不要忽略备份验证**：无法恢复的备份毫无意义
- **不要存储在同一位置**：避免单点故障
- **不要忘记备份配置**：环境变量、密码等

## 故障排查

### 问题 1：备份文件为空

**症状**：备份 SQL 文件大小为 0 字节

**解决方案**：
```bash
# 检查数据库连接
docker exec pg16 psql -U myuser -d whitenote -c "SELECT 1;"

# 检查磁盘空间
docker exec pg16 df -h

# 重新执行备份
docker exec pg16 pg_dump -U myuser -d whitenote --verbose --no-owner --no-acl > backup.sql
```

### 问题 2：恢复时权限错误

**症状**：`ERROR: permission denied for table xxx`

**解决方案**：
```bash
# 使用 --no-owner --no-acl 选项备份
docker exec pg16 pg_dump -U myuser -d whitenote --no-owner --no-acl > backup.sql

# 或者恢复后重新设置权限
docker exec pg16 psql -U myuser -d whitenote -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myuser;"
```

### 问题 3：恢复后数据不完整

**检查**：
```bash
# 比较备份前后的数据量
docker exec pg16 psql -U myuser -d whitenote -c "
  SELECT
    'User' as table_name, COUNT(*) as count FROM \"User\"
  UNION ALL
  SELECT 'Workspace', COUNT(*) FROM \"Workspace\"
  UNION ALL
  SELECT 'Message', COUNT(*) FROM \"Message\"
  UNION ALL
  SELECT 'Comment', COUNT(*) FROM \"Comment\";
"
```

## 相关文档

- [数据库恢复指南](./DATABASE_RESTORE_GUIDE.md)
- [Docker 部署指南](./DOCKER_DEPLOYMENT.md)
- [灾难恢复计划](./DISASTER_RECOVERY.md)
