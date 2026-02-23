# 双向同步修复文档

## 问题描述

在 WhiteNote 中，用户期望实现 **Web 界面** 和 **本地 Markdown 文件** 之间的双向同步：

- **Web → 本地**：在 Web 界面编辑消息后，自动更新本地 `.md` 文件
- **本地 → Web**：手动编辑本地 `.md` 文件后，自动更新数据库中的消息

然而，在某个时间点后，双向同步功能失效，特别是 **本地 → Web** 的同步不再工作。

## 问题根源

### 核心问题：竞态条件 (Race Condition)

双向同步失效的根本原因是 **"跳过逻辑"与"导入时机"的冲突**：

```
1. Web 编辑 → exportToLocal 写入文件
2. File watcher 立即检测到文件变化
3. 跳过逻辑检查：fileAge < 2000ms
4. 因为文件太新（< 2秒），被跳过
5. 下次扫描时，文件仍然在 1-2 秒前被修改
6. 循环往复，文件永远"太新"，无法导入
```

### 关键代码逻辑

在 `src/lib/file-watcher/index.ts` 中：

```typescript
// Check file age - skip files created/modified in the last 2 seconds
const fileAge = Date.now() - stats.mtimeMs

if (fileAge < 2000) {
  // Increment skip count
  const currentSkipCount = fileSkipCounts.get(fileKey) || 0
  fileSkipCounts.set(fileKey, currentSkipCount + 1)

  if (currentSkipCount < MAX_SKIP_COUNT) {
    console.log(`[FileWatcher] Skipping recent file (${fileAge}ms ago, skip ${currentSkipCount + 1}/${MAX_SKIP_COUNT}): ${item.name}`)
    continue
  }
}
```

**问题**：`exportToLocal` 写入文件后，file watcher 几乎立即检测到变化，但文件年龄始终 < 2000ms，导致持续跳过。

### 触发场景

1. **用户在 Web 界面编辑消息** → `exportToLocal` 被调用
2. **`exportToLocal` 写入 `.md` 文件** → 文件 `mtime` 更新
3. **File watcher 检测到变化** → 但因为 `fileAge < 2000` 而跳过
4. **下次扫描时** → 如果 `importFromLocal` 更新了数据库，可能再次触发 `exportToLocal`
5. **循环** → 文件一直被跳过，永远无法从本地导入

## 解决方案

### 核心思路：Redis 协调机制

使用 Redis 作为**分布式锁**，协调导出和导入操作，避免竞态条件。

### 修改 1：导出时暂停 File Watcher

**文件**：`src/lib/sync-utils.ts`

**位置**：`exportToLocal` 函数，消息和评论导出部分

```typescript
// Check if file content has actually changed
let shouldWrite = true
if (fs.existsSync(filePath)) {
  const existingContent = fs.readFileSync(filePath, "utf-8")
  if (existingContent === fileContent) {
    shouldWrite = false
    console.log(`[SyncUtils] File content unchanged, skipping write: ${currentFilename}`)
  }
}

if (shouldWrite) {
  // Pause file watcher to prevent it from importing the file we just exported
  // This avoids the "too recent" skip issue and circular sync
  await redis.set("file-watcher:paused", "1", "EX", 5) // Pause for 5 seconds

  // Write file
  fs.writeFileSync(filePath, fileContent)
}
```

**作用**：
- 当 Web 编辑导出文件时，暂停 file watcher 5 秒
- 避免导出时被误判为手动编辑
- 5 秒足够完成导出和 metadata 更新

### 修改 2：导入时暂停 File Watcher

**文件**：`src/lib/sync-utils.ts`

**位置**：`importFromLocal` 函数开头

```typescript
export async function importFromLocal(workspaceId: string, filePath: string) {
  // Pause file watcher during import to prevent race conditions
  await redis.set("file-watcher:paused", "1", "EX", 3)

  const parsed = parseFilePath(filePath)
  // ... rest of import logic
}
```

**作用**：
- 当手动编辑导入时，暂停 file watcher 3 秒
- 避免更新数据库时触发新的文件检测
- 3 秒足够完成数据库更新和 metadata 写入

### 修改 3：内容比较优化

**文件**：`src/lib/sync-utils.ts`

**位置**：`exportToLocal` 函数，写入文件前

```typescript
// Check if file content has actually changed
let shouldWrite = true
if (fs.existsSync(filePath)) {
  const existingContent = fs.readFileSync(filePath, "utf-8")
  if (existingContent === fileContent) {
    shouldWrite = false
    console.log(`[SyncUtils] File content unchanged, skipping write: ${currentFilename}`)
  }
}

if (shouldWrite) {
  // Only write and pause watcher if content actually changed
  await redis.set("file-watcher:paused", "1", "EX", 5)
  fs.writeFileSync(filePath, fileContent)
}
```

**作用**：
- 只有当文件内容真正改变时才写入文件
- 避免不必要的 file watcher 事件
- 减少 Redis 暂停次数

## 修复效果

### 本地 → Web 同步

**用户操作**：手动编辑 `data/link_md/Codes/18789-端口被占用可以用以下命令再检查一下.md`

**Worker 日志**：
```
[FileWatcher] Modified file detected: 测试001.md in workspace cmldga55f007901p3s2z2wk2i
[FileWatcher] Processing data\link_md\默认\测试001.md
[SyncUtils] Imported data\link_md\默认\测试001.md to DB with 1 tags
[FileWatcher] ✓ Imported data\link_md\默认\测试001.md
```

**结果**：数据库中的消息内容被更新，Web 界面刷新后可以看到新内容。

### Web → 本地 同步

**用户操作**：在 Web 界面编辑消息

**Dev 日志**：
```
[SyncUtils] Using existing filename for message cmlz58n6l0001qsimpqhlr3dm: 测试001.md
[SyncUtils] Exported message cmlz58n6l0001qsimpqhlr3dm to cmldga55f007901p3s2z2wk2i/测试001.md
PUT /api/messages/cmlz58n6l0001qsimpqhlr3dm 200
```

**结果**：本地 `.md` 文件被更新，文件内容与 Web 界面一致。

### File Watcher 暂停日志

```
[FileWatcher] Watcher paused, ignoring change: 默认\.whitenote\workspace.json
[FileWatcher] Watcher paused, ignoring change: 默认\测试001.md
```

**说明**：Redis 暂停机制正在工作，避免循环同步。

## 技术亮点

### 1. Redis 协调机制

- 使用 Redis 作为分布式锁
- 键名：`file-watcher:paused`
- 值：`"1"`
- 过期时间：导出 5 秒，导入 3 秒

### 2. 时间窗口管理

| 操作 | 暂停时长 | 原因 |
|------|---------|------|
| 导出 (Web → 本地) | 5 秒 | 完成文件写入 + metadata 更新 |
| 导入 (本地 → Web) | 3 秒 | 完成数据库更新 + metadata 更新 |

### 3. 智能跳过检测

- 连续跳过 3 次后强制处理
- 避免因频繁保存导致的无限跳过
- 在 `file-watcher/index.ts` 中实现：

```typescript
if (currentSkipCount < MAX_SKIP_COUNT) {
  console.log(`[FileWatcher] Skipping recent file (${fileAge}ms ago, skip ${currentSkipCount + 1}/${MAX_SKIP_COUNT}): ${item.name}`)
  continue
} else {
  console.log(`[FileWatcher] File skipped ${MAX_SKIP_COUNT} times, forcing process: ${item.name}`)
  fileSkipCounts.delete(fileKey)
}
```

### 4. 内容去重优化

- 写入前比较文件内容
- 避免相同内容的重复写入
- 减少文件系统事件和 Redis 操作

## 架构图

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Web UI     │────────▶│  API Route   │────────▶│  Database   │
│  (编辑)     │         │  (PUT /api/  │         │  (Prisma)   │
└─────────────┘         │   messages)  │         └─────────────┘
                        └──────────────┘                │
                               │                        │
                               │ exportToLocal          │
                               ▼                        │
                        ┌──────────────┐                │
                        │  Redis Lock  │                │
                        │  (暂停 5s)   │                │
                        └──────────────┘                │
                               │                        │
                               ▼                        ▼
                        ┌──────────────┐         ┌─────────────┐
                        │  Local File  │         │  File       │
                        │  (.md)       │◀────────│  Watcher    │
                        └──────────────┘   暂停  └─────────────┘
                               │                        ▲
                               │                        │
                               │ importFromLocal       │
                               │   (暂停 3s)           │
                               ▼                        │
                        ┌──────────────┐                │
                        │  Redis Lock  │────────────────┘
                        │  (暂停 3s)   │    检测文件变化
                        └──────────────┘
```

## 相关文件

| 文件 | 修改内容 |
|------|---------|
| `src/lib/sync-utils.ts` | 添加 Redis 暂停逻辑，内容比较优化 |
| `src/lib/file-watcher/index.ts` | 跳过逻辑，强制处理机制 |
| `src/app/api/messages/[id]/route.ts` | 调用 `exportToLocal` |
| `src/app/api/comments/[id]/route.ts` | 调用 `exportToLocal` |

## 测试验证

### 测试场景 1：Web → 本地

1. 在 Web 界面编辑消息
2. 检查本地 `.md` 文件是否更新
3. 验证文件内容与 Web 界面一致

### 测试场景 2：本地 → Web

1. 手动编辑本地 `.md` 文件
2. 等待 5-10 秒
3. 刷新 Web 界面，检查消息是否更新

### 测试场景 3：快速连续编辑

1. 在 Web 界面快速编辑多次
2. 验证不会出现循环同步
3. 验证文件内容最终一致

## 经验总结

### 问题诊断

1. **日志分析**：通过 `[FileWatcher] Skipping recent file` 日志发现跳过逻辑
2. **时间戳对比**：发现文件 mtime 和 workspace.json updated_at 匹配
3. **时序分析**：理解 export 和 import 的执行顺序

### 解决思路

1. **隔离操作**：使用 Redis 锁隔离导出和导入操作
2. **时间窗口**：给予足够的缓冲时间完成操作
3. **智能跳过**：避免无限跳过，强制处理机制
4. **内容去重**：减少不必要的文件操作

### 最佳实践

1. **竞态条件**：多进程/多线程环境需要协调机制
2. **文件监听**：考虑文件系统事件的频率和时机
3. **日志优先**：详细的日志是调试的关键
4. **渐进修复**：先解决核心问题，再优化细节

## 未来改进

1. **配置化暂停时间**：将暂停时间作为配置项，便于调优
2. **更精确的变化检测**：使用文件哈希而不是时间戳
3. **批量处理**：对频繁的文件变化进行批量处理
4. **冲突解决**：当 Web 和本地同时修改时的冲突解决策略

---

**修复日期**：2026-02-23

**修复版本**：v0.1.0

**修复作者**：Claude Code + 用户协作
