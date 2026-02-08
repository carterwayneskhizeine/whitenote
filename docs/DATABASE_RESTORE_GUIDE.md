# 数据库恢复指南

从本地的 `.md` 文件和 `.whitenote/workspace.json` 恢复 Docker 数据库。

## 适用场景

- 重新部署 Docker 环境
- 数据库被意外清空
- 迁移到新服务器
- 开发环境数据同步

## 前置条件

### 1. 检查本地文件结构

确保你的本地文件结构如下：

```
D:\Code\whitenote\data\link_md\
├── Workspace1\           # 工作区文件夹
│   ├── .whitenote\
│   │   └── workspace.json   # 工作区元数据
│   ├── post1.md            # 消息文件
│   ├── post2.md
│   └── message_xxx\        # 评论文件夹
│       ├── comment1.md
│       └── comment2.md
├── Workspace2\
│   └── ...
└── ...
```

### 2. 确认 Docker 容器运行

```bash
# 检查 Docker 服务状态
docker-compose ps

# 输出应显示所有服务为 Up 状态
```

## 方法一：使用自动恢复脚本（推荐）

### 步骤 1：准备恢复脚本

恢复脚本位于：`scripts/restore-from-workspace-json.js`

### 步骤 2：确保数据文件在正确位置

```bash
# 如果你的数据在其他位置，复制到项目 data 目录
# 例如从 D:\Code\whitenote-data\link_md 复制到 D:\Code\whitenote\data\link_md
cp -r "D:\Code\whitenote-data\link_md"* "D:\Code\whitenote\data\link_md/"
```

### 步骤 3：运行恢复脚本

```bash
# 将脚本复制到 Docker 容器
docker cp scripts/restore-from-workspace-json.js whitenote-app:/app/scripts/restore-from-workspace-json.js

# 在容器中执行恢复
docker exec whitenote-app sh -c "cd /app && node scripts/restore-from-workspace-json.js"
```

### 步骤 4：验证恢复结果

```bash
# 检查 workspace 数量
docker exec pg16 psql -U myuser -d whitenote -c "SELECT COUNT(*) FROM \"Workspace\";"

# 检查消息数量
docker exec pg16 psql -U myuser -d whitenote -c "SELECT COUNT(*) FROM \"Message\";"

# 检查评论数量
docker exec pg16 psql -U myuser -d whitenote -c "SELECT COUNT(*) FROM \"Comment\";"
```

## 方法二：手动恢复（高级用户）

### 步骤 1：清空现有数据库（可选）

```bash
# 停止应用服务
docker-compose stop app worker

# 连接到数据库
docker exec -it pg16 psql -U myuser -d whitenote

# 在 psql 中执行：
TRUNCATE TABLE "Comment" CASCADE;
TRUNCATE TABLE "Message" CASCADE;
TRUNCATE TABLE "Workspace" CASCADE;
\q
```

### 步骤 2：手动执行 SQL 恢复

如果你有 SQL 备份文件：

```bash
# 从备份文件恢复
docker exec -i pg16 psql -U myuser -d whitenote < backups/whitenote_backup.sql

# 或者恢复特定的转储文件
docker exec -i pg16 psql -U myuser -d whitenote < backups/whitenote_backup_20260208_184752.sql
```

### 步骤 3：重新启动服务

```bash
docker-compose up -d app worker
```

## 恢复脚本工作原理

### 数据处理流程

```
1. 读取 workspace.json
   ├── 提取 Workspace 信息
   ├── 提取 Messages 列表
   └── 提取 Comments 列表

2. 创建 Workspace 记录
   ├── 保持原有 ID
   ├── 关联到当前用户
   └── 恢复时间戳

3. 创建 Message 记录
   ├── 读取 .md 文件内容
   ├── 保持原有 ID 和时间戳
   └── 关联到 Workspace

4. 创建 Comment 记录
   ├── 从 message_xxx 文件夹读取
   ├── 处理评论层级（顶层评论 → 回复）
   ├── 保持原有 ID 和时间戳
   └── 处理父子关系
```

### 关键特性

- **幂等性**：可以多次运行，已存在的记录会被跳过
- **层级处理**：先创建顶层评论，再创建回复，避免外键约束错误
- **错误处理**：单个记录失败不会中断整个恢复过程
- **统计报告**：显示恢复成功的记录数量和错误信息

## 常见问题

### Q1: 恢复时出现 "Foreign key constraint violated" 错误

**原因**：评论的 `parentId` 引用了不存在的评论

**解决方案**：
- 这是正常的，通常发生在深层嵌套评论
- 脚本会继续处理其他记录
- 失败的评论数量会在错误统计中显示

### Q2: 部分消息或评论未恢复

**检查清单**：
```bash
# 1. 确认本地文件存在
ls "D:\Code\whitenote\data\link_md\WorkspaceName\.whitenote\workspace.json"

# 2. 检查文件内容格式
cat "D:\Code\whitenote\data\link_md\WorkspaceName\.whitenote\workspace.json" | jq .

# 3. 验证 .md 文件可读
head "D:\Code\whitenote\data\link_md\WorkspaceName\post.md"
```

### Q3: 用户不匹配

**原因**：恢复脚本使用当前数据库中的第一个用户

**解决方案**：
```bash
# 检查数据库中的用户
docker exec pg16 psql -U myuser -d whitenote -c "SELECT id, email FROM \"User\";"

# 如果需要修改用户，编辑脚本中的 user 查询逻辑
```

### Q4: 恢复后看不到数据

**检查步骤**：
1. 确认应用已重新加载：
   ```bash
   docker-compose restart app
   ```

2. 清除浏览器缓存并刷新页面

3. 检查 workspace 切换器是否选择了正确的工作区

## 完整示例

### 场景：从备份恢复到新的 Docker 实例

```bash
# 1. 启动 Docker 服务
cd D:\Code\whitenote
docker-compose up -d

# 2. 等待数据库就绪
docker exec pg16 pg_isready -U myuser -d whitenote

# 3. 复制恢复脚本
docker cp scripts/restore-from-workspace-json.js whitenote-app:/app/scripts/

# 4. 执行恢复
docker exec whitenote-app sh -c "cd /app && node scripts/restore-from-workspace-json.js"

# 5. 验证结果
docker exec pg16 psql -U myuser -d whitenote -c "
  SELECT
    (SELECT COUNT(*) FROM \"Workspace\") as workspaces,
    (SELECT COUNT(*) FROM \"Message\") as messages,
    (SELECT COUNT(*) FROM \"Comment\") as comments;
"

# 6. 重启应用加载新数据
docker-compose restart app worker
```

## 预期输出

成功恢复时你会看到类似输出：

```
Starting database restoration from workspace.json files...

Using user: whitenote@gmail.com (cmldg9wec007701p3j9b2cwnp)


📁 Processing: Notes
   Original ID: cmkye6ocf00020zw6wfe2rq2b
   🆕 Creating new workspace...
   ✅ Workspace: Notes (cmkye6ocf00020zw6wfe2rq2b)
      📝 Created: 备案.md
      📝 Created: 反向总观效应.md

   💬 Processing 15 comments...
      💬 Created comment: 评论1.md
      💬 Created reply: 回复1.md

📁 Processing: Codes
   Original ID: cmkyjl0oc0004u4im0cxpe9lb
   ✅ Workspace already exists, updating...
   ...

==================================================
Restoration Summary:
  Workspaces: 12
  Messages: 250
  Comments: 38
  Errors: 2
==================================================
```

## 下一步

恢复完成后，建议：

1. **验证数据完整性**
   - 在 Web UI 中检查各 workspace
   - 确认消息和评论显示正确
   - 检查时间线是否正确

2. **创建新的备份**
   - 参考 [数据库备份指南](./DATABASE_BACKUP_GUIDE.md)

3. **配置定期备份**
   - 设置 cron 任务自动备份
   - 保留多个版本的备份

## 相关文档

- [数据库备份指南](./DATABASE_BACKUP_GUIDE.md)
- [Docker 部署指南](./DOCKER_DEPLOYMENT.md)
- [文件同步系统说明](./SYNC_SIMPLIFICATION_PROPOSAL.md)
