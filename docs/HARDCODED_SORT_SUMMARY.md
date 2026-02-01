# 评论排序硬编码修改汇总

## 📝 修改说明

已将分享页面的评论排序方式从数据库配置改为代码硬编码。

## 🔧 修改的文件

### API 端点（4个文件）

1. **[src/app/api/public/messages/[id]/route.ts:68](src/app/api/public/messages/[id]/route.ts#L68)**
   ```typescript
   const HARDCODED_SORT_ORDER = false  // 帖子的顶级评论排序
   ```

2. **[src/app/api/public/messages/[id]/comments/route.ts:13](src/app/api/public/messages/[id]/comments/route.ts#L13)**
   ```typescript
   const HARDCODED_SORT_ORDER = false  // 顶级评论列表排序
   ```

3. **[src/app/api/public/comments/[id]/route.ts:60](src/app/api/public/comments/[id]/route.ts#L60)**
   ```typescript
   const HARDCODED_SORT_ORDER = false  // 评论详情页排序偏好
   ```

4. **[src/app/api/public/comments/[id]/children/route.ts:12](src/app/api/public/comments/[id]/children/route.ts#L12)**
   ```typescript
   const HARDCODED_SORT_ORDER = false  // 子评论回复排序
   ```

### 前端组件（2个文件）

5. **[src/components/PublicCommentsList.tsx](src/components/PublicCommentsList.tsx#L32)**
   - 移除了 `newestFirst` 查询参数
   - 移除了 `getCommentSortOrder` 导入

6. **[src/app/share/comment/[id]/page.tsx](src/app/share/comment/[id]/page.tsx#L87)**
   - 移除了 `newestFirst` 查询参数
   - 移除了 `getCommentSortOrder` 导入

### 数据库和设置

7. **[prisma/schema.prisma](prisma/schema.prisma)**
   - 从 `AiConfig` 模型中移除了 `shareCommentsOrderNewestFirst` 字段

8. **[src/components/PrivacySettingsForm.tsx](src/components/PrivacySettingsForm.tsx#L90)**
   - 移除了"分享帖子的评论区排序"开关
   - 显示说明文本："分享帖子的评论区排序方式已设置为硬编码：最早靠前"

9. **[src/types/api.ts](src/types/api.ts)**
   - 从 `AIConfig` 和 `UpdateAIConfigInput` 接口中移除了字段

10. **[src/app/api/config/route.ts](src/app/api/config/route.ts#L57)**
    - 从允许更新的字段列表中移除了该字段

## 🎛️ 如何切换排序方式

要切换评论排序（**最新靠前** / **最早靠前**），修改以下 **4 个文件** 中的 `HARDCODED_SORT_ORDER` 常量：

```typescript
// true = 最新靠前，false = 最早靠前
const HARDCODED_SORT_ORDER = false  // 改为 true 即可切换
```

### 需要修改的文件：

1. `src/app/api/public/messages/[id]/route.ts`
2. `src/app/api/public/messages/[id]/comments/route.ts`
3. `src/app/api/public/comments/[id]/route.ts`
4. `src/app/api/public/comments/[id]/children/route.ts`

## ⚙️ 应用更改

修改后需要重启开发服务器：

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
pnpm dev
```

## ✅ 验证

访问任意分享页面（如 `/share/comment/xxx`），评论应该按照硬编码的顺序排列：
- `HARDCODED_SORT_ORDER = false` → 最早的评论在前
- `HARDCODED_SORT_ORDER = true` → 最新的评论在前

## 📅 修改日期

2026-02-02
