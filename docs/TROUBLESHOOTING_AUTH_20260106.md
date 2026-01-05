# 故障排查报告：认证与中间件问题 (2026-01-06)

## 1. 当前遇到的问题

### 1.1 中间件重定向失效 (Middleware Redirection)
- **现象**: 访问根路径 `http://localhost:3005/` 时，未登录用户没有被重定向到 `/register`。
- **背景**:
    - 项目使用了 Next.js 16.1.1 和 NextAuth 5.0.0-beta.30。
    - 用户指出 Next.js 16 可能倾向于使用 `proxy.ts` 而非 `middleware.ts`。
- **当前状态**:
    - 代码逻辑保留在 `src/proxy.ts` 中。
    - 创建了 `src/middleware.ts` 作为桥接，导入并执行 `proxy` 函数。
    - 仍然报告没有跳转。

### 1.2 认证会话接口 404 (Auth Session 404)
- **现象**: 浏览器控制台报错 `ClientFetchError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`。
- **网络请求**: `GET http://localhost:3005/api/auth/session` 返回 **404 Not Found**。
- **影响**: 前端无法获取用户会话状态，导致 `SessionProvider` 报错，页面可能因此崩溃或无法正确渲染，进而掩盖了中间件的重定向行为。

---

## 2. 问题分析与可能原因

### 2.1 针对 Auth API 404 错误
这是当前最紧急的问题。如果 `/api/auth/session` 返回 404，说明 NextAuth 的路由处理程序没有正确加载或匹配。

**可能原因**:
1.  **环境变量缺失**: NextAuth v5 (Auth.js) **强制要求** 设置 `AUTH_SECRET` 环境变量。旧版本使用的是 `NEXTAUTH_SECRET`。如果缺失，生产环境下（或某些开发配置下）API 路由可能会失效。
2.  **数据库连接**: 虽然 404 通常指路由不存在，但如果 Prisma 初始化失败（例如端口配置错误），可能会导致 Auth 路由崩溃。
    - *检查点*: Docker 中 Postgres 映射端口为 `5925`，但代码/Env 中可能配置为默认的 `5432`。
3.  **路由文件导出**: NextAuth v5 的路由文件 `src/app/api/auth/[...nextauth]/route.ts` 写法需要严格遵循规范。当前写法使用了 `export const runtime = 'nodejs'`，这通常是正确的，但需要确认 `handlers` 导出是否正确。

### 2.2 针对中间件问题
**可能原因**:
1.  **文件冲突**: 如果 `src/middleware.ts` 和 `src/proxy.ts` 同时存在，或者 Next.js 缓存了旧构建，可能导致行为异常。
2.  **配置导出**: `src/middleware.ts` 中必须直接导出 `config` 对象，不能重导出。目前已修复此点，但需确认 `matcher` 是否正确覆盖了目标路径。

---

## 3. 建议解决方案 (逐步执行)

### 步骤 1: 修复环境变量 (Critical)
NextAuth v5 需要 `AUTH_SECRET`。请检查 `.env` 文件。

**操作建议**:
- 确保 `.env` 中包含 `AUTH_SECRET`（可以直接复制 `NEXTAUTH_SECRET` 的值）。
- 检查 `DATABASE_URL`。Docker 显示 Postgres 端口为 **5925** (`0.0.0.0:5925->5432/tcp`)。
    - 如果 `.env` 中是 `localhost:5432`，请改为 `localhost:5925`。

### 步骤 2: 验证 Auth API 路由
确保 `src/app/api/auth/[...nextauth]/route.ts` 能被 Next.js 识别。

**调试方法**:
- 尝试访问 `http://localhost:3005/api/auth/providers`。如果这也返回 404，说明整个 Auth 路由都没挂载成功。
- 如果返回 JSON，说明路由是好的，只是 `session` 接口有问题。

### 步骤 3: 简化中间件 (用于测试)
为了排除 `proxy.ts` 桥接带来的不确定性，建议暂时直接使用标准的 `src/middleware.ts` 写法进行测试。

**测试代码 (`src/middleware.ts`)**:
```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth" // 如果能直接导入 auth

export async function middleware(request: NextRequest) {
  // 简单的 console.log 调试
  console.log("Middleware hitting:", request.nextUrl.pathname)
  
  // ... 原有逻辑
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

### 步骤 4: 重启开发服务器
修改环境变量或中间件文件结构后，务必完全重启开发服务器：
1. 停止 `pnpm dev`。
2. 删除 `.next` 缓存文件夹 (可选但推荐)。
3. 重新运行 `pnpm dev`。

---

## 4. 总结
目前的 `ClientFetchError` (404) 极有可能是环境变量配置（特别是端口和密钥）导致的 API 路由初始化失败。解决了 API 404 问题后，中间件的重定向问题可能会随之解决，或者更容易调试。
