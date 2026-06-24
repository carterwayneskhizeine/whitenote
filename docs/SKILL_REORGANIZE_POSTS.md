# Skill: AI 整理 WhiteNote 帖子

## 背景

WhiteNote 的帖子通过 `POST /api/sync/export-all` 导出为 markdown 文件到 `data/link_md/` 目录。
AI 对这些文件进行分类、合并、重写后，再通过 `POST /api/sync/import-all` 导回数据库。
最后通过 `POST /api/ai/reindex` 重新生成向量嵌入。

## 目录结构

```
data/link_md/
├── Codes/                          ← workspace 文件夹（以 workspace 名称命名）
│   ├── .whitenote/
│   │   └── workspace.json          ← ⚠️ 映射表，不要手动编辑
│   ├── openclaw-流式响应总结.md      ← 帖子（message）
│   ├── openclaw-流式响应总结/        ← 评论子文件夹（以帖子的 commentFolderName 命名）
│   │   ├── 日志分析-abc123.md       ← 评论（comment）
│   │   └── 修复方案-def456.md
│   └── 另一个帖子.md
├── OpenClaw/
│   ├── .whitenote/workspace.json
│   └── ...
└── Pinokio/
    └── ...
```

## Markdown 格式

每个 .md 文件格式固定：

```markdown
#tag1 #tag2 #tag3

正文内容从这里开始...
```

- **第一行**：标签行，格式为 `#标签` 用空格分隔。没有标签时第一行为空行
- **第二行**：空行
- **第三行起**：正文内容

`parseMdFile()` 的解析逻辑：
1. 读取第一行，用正则 `#[\w一-龥]+` 提取标签
2. 第二行起全部作为正文

## workspace.json 结构

每个 workspace 文件夹下的 `.whitenote/workspace.json` 维护文件名到数据库 ID 的映射：

```json
{
  "version": 2,
  "workspace": {
    "id": "cmkyjl0oc0004u4im0cxpe9lb",
    "originalFolderName": "Codes",
    "currentFolderName": "Codes",
    "name": "Codes",
    "lastSyncedAt": "2026-05-24T00:00:00.000Z"
  },
  "messages": {
    "message_clxabc123.md": {
      "id": "clxabc123",
      "type": "message",
      "originalFilename": "message_clxabc123.md",
      "currentFilename": "openclaw-流式响应总结.md",
      "commentFolderName": "openclaw-流式响应总结",
      "created_at": "...",
      "updated_at": "...",
      "tags": "#openclaw #流式"
    }
  },
  "comments": {
    "comment_xyz789.md": {
      "id": "xyz789",
      "type": "comment",
      "messageId": "clxabc123",
      "parentId": null,
      "originalFilename": "comment_xyz789.md",
      "currentFilename": "日志分析-abc123.md",
      "folderName": "openclaw-流式响应总结",
      "created_at": "...",
      "updated_at": "...",
      "tags": ""
    }
  }
}
```

## 导入检测机制

`importAllFromLocal` 通过以下方式判断文件是否需要导入：

1. 用文件路径在 workspace.json 中查找映射（通过 `currentFilename` 匹配）
2. 比较文件的 `mtime`（文件修改时间）与 workspace.json 中的 `updated_at`
3. **只有 mtime 与记录不一致时才触发导入**

这意味着：修改文件内容后必须确保文件的修改时间发生了变化。

## 操作分类

### ✅ 安全操作（不需要额外处理）

这些操作不会影响 workspace.json 映射，导回时自动生效：

| 操作 | 说明 |
|------|------|
| 修改正文内容 | 只改第三行起的内容 |
| 修改标签 | 只改第一行的标签 |
| 添加标签 | 在第一行添加新标签 |
| 删除标签 | 从第一行移除标签 |
| 重写/润色正文 | AI 重写内容，保持语义一致 |

### ⚠️ 有条件安全（需要注意副作用）

| 操作 | 风险 | 处理方式 |
|------|------|----------|
| 合并多个帖子为一个文件 | 被合并掉的帖子的 workspace.json 映射变成孤儿，原数据库记录保留旧内容 | 见下方「合并帖子」流程 |
| 拆分一个帖子为多个文件 | 新文件在 workspace.json 中无映射，会被 skip | 不支持，改为在数据库层面操作 |
| 删除帖子文件 | 数据库记录保留，workspace.json 映射残留 | 导回后需手动清理数据库 |

### ❌ 危险操作（会破坏导入）

| 操作 | 后果 |
|------|------|
| 重命名 .md 文件 | workspace.json 中的 `currentFilename` 与实际文件名不匹配，导入时找不到文件 |
| 移动 .md 文件到其他文件夹 | 同上，路径解析失败 |
| 重命名评论子文件夹 | workspace.json 中 `commentFolderName` / `folderName` 失效 |
| 删除 workspace.json | 全部映射丢失，无法导回 |
| 修改 workspace.json | 映射错乱，内容可能写入错误的数据库记录 |

## 合并帖子的完整流程

当需要把多个短帖合并为一篇时，不能简单删除文件，否则数据库会留下孤立记录。
正确流程如下：

### 第一步：在 markdown 层面完成合并

1. 选择要合并的多个 .md 文件（记下它们的文件名）
2. 将内容合并到一个文件中（保留一个，其余清空）
3. 保留的文件正常写合并后的内容
4. **被合并掉的文件不要删除**，而是写入特殊标记：

```markdown
#merged

[已合并到 另一个文件名.md]
```

这样做的目的是让 workspace.json 映射仍然有效，但内容被标记为已合并。

### 第二步：导回后清理数据库

导回完成后，需要手动执行数据库清理。运行以下 SQL（或通过 Prisma Studio）：

```sql
-- 查找所有被标记为已合并的消息
SELECT id, content FROM Message WHERE content LIKE '[已合并到%';

-- 确认无误后删除（同时会删除关联的评论、标签等）
-- 注意：需要先删评论，再删消息
DELETE FROM CommentTag WHERE commentId IN (
  SELECT c.id FROM Comment c
  JOIN Message m ON m.id = c.messageId
  WHERE m.content LIKE '[已合并到%'
);
DELETE FROM Comment WHERE messageId IN (
  SELECT id FROM Message WHERE content LIKE '[已合并到%'
);
DELETE FROM MessageTag WHERE messageId IN (
  SELECT id FROM Message WHERE content LIKE '[已合并到%'
);
DELETE FROM Message WHERE content LIKE '[已合并到%';
```

### 第三步：清理 workspace.json 和文件

数据库清理完成后，删除对应的 .md 文件，并更新 workspace.json 移除被删帖子的映射。
最简单的方式是重新执行 `POST /api/sync/export-all`，它会重新生成正确的映射。

## AI 整理时的 Prompt 模板

当使用 AI 工具整理 markdown 文件时，提供以下规则：

```
你正在整理 WhiteNote 社交平台的帖子。以下是必须遵守的规则：

1. 文件格式：每个 .md 文件第一行是标签行（#tag1 #tag2 格式），
   第二行是空行，第三行起是正文。必须保持这个格式。

2. 你只能修改文件内容（标签 + 正文），不能：
   - 重命名文件
   - 移动文件
   - 删除文件
   - 创建新文件

3. 如果要合并多个帖子，将被合并的文件内容替换为：
   #merged
   [已合并到 目标文件名.md]
   然后在目标文件中写入合并后的完整内容。

4. 整理目标：
   - 补充缺失的标签（根据内容推断）
   - 润色碎片化的短帖，使其成为完整可读的笔记
   - 保持原始语义和关键信息不丢失
   - 合并主题相同的帖子

5. 注意评论子文件夹中的 .md 文件属于该帖子的评论，
   通常不需要合并或移动。
```

## 数据概况（导出前参考）

- 总帖子数：528 条
- 总评论数：66 条
- workspace 数：29 个
- 短消息（<50 字）：约 116 条，主要集中在 Codes(27)、OpenClaw(15)、ReLink(13)
- 有评论的帖子：约 20 条（评论数 2-17 不等）
- 引用消息数：0
- 转发数：0

## 完整操作步骤

```bash
# 0. 备份数据库
cp data/whitenote.db data/whitenote.db.bak

# 1. 导出所有帖子为 markdown
curl -X POST http://localhost:3005/api/sync/export-all

# 2. 用 AI 处理 data/link_md/ 下的 .md 文件
#    （遵守上述规则）

# 3. 导回数据库
curl -X POST http://localhost:3005/api/sync/import-all

# 4. 清理已合并的帖子（如果有）
#    执行上方 SQL

# 5. 重新导出一次（刷新 workspace.json 映射）
curl -X POST http://localhost:3005/api/sync/export-all

# 6. 重新生成向量嵌入
curl -X POST http://localhost:3005/api/ai/reindex

# 7. 验证结果
#    打开 Prisma Studio 检查：pnpm prisma studio
#    或在 WhiteNote 中浏览帖子

# 8. 回滚（如果不满意）
cp data/whitenote.db.bak data/whitenote.db
```
