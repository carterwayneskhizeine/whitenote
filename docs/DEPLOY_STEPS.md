# 部署步骤：修复评论排序

## 问题描述
评论排序硬编码没有生效，API 仍然返回降序（最新在前），而不是升序（最早在前）。

## 原因
Next.js 的服务器端代码已被编译并缓存。修改 `.ts` 文件后需要重新构建才能生效。

## 解决方案

### 1. 清除 Next.js 缓存并重新构建
```bash
# 停止当前运行的服务器
# 然后执行：

# 清除 .next 缓存
rm -rf .next

# 重新构建
pnpm build

# 重启开发服务器
pnpm dev
```

### 2. 如果是生产环境
```bash
# 清除缓存并重新构建
rm -rf .next
pnpm build

# 重启生产服务器
pnpm start
```

## 验证步骤

### 测试 1: 验证 API 返回顺序
```bash
node debug-api-response.js
```

应该看到：
- 升序（最早→最新）: ✅ 是
- 降序（最新→最早）: ❌ 否

### 测试 2: 在浏览器中验证
1. 清除浏览器缓存（Ctrl+Shift+Delete）
2. 硬刷新页面（Ctrl+Shift+R）
3. 访问分享评论页面，检查评论顺序

## 修改的文件列表
- `src/app/api/public/messages/[id]/comments/route.ts` (第14行)
- `src/app/api/public/comments/[id]/children/route.ts` (第14行)
- `src/app/api/public/messages/[id]/route.ts` (第68行)
- `src/app/api/public/comments/[id]/route.ts` (第60行)

所有这些文件的 `HARDCODED_SORT_ORDER` 都设置为 `false`（升序，最早在前）。
