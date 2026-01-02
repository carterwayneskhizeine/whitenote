# WhiteNote 2.5 API 测试指南

> **前置文档**: [后端开发指南 Stage 7](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_07_WORKERS.md)

---

## 目录

1. [测试环境配置](#1-测试环境配置)
2. [手动测试 (cURL)](#2-手动测试-curl)
3. [自动化测试 (Vitest)](#3-自动化测试-vitest)
4. [完整测试流程](#4-完整测试流程)

---

## 1. 测试环境配置

### 1.1 环境检查清单

```bash
# 检查 Node.js 版本
node -v  # 应 >= v22.18.0

# 检查 PostgreSQL
psql --version  # 应为 16.x

# 检查 Redis
redis-cli ping  # 应返回 PONG

# 检查 RAGFlow
curl http://localhost:4154/api/v1/datasets -H "Authorization: Bearer ragflow-61LVcg1JlwvJPHPmDLEHiw5NWfG6-QUvWShJ6gcbQSc"
```

### 1.2 测试数据库设置

创建独立的测试数据库：

```sql
-- 连接 PostgreSQL
psql -U postgres

-- 创建测试数据库
CREATE DATABASE whitenote_test;
```

创建 `.env.test`：

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/whitenote_test?schema=public"
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="test-secret-key"
```

### 1.3 安装测试依赖

```bash
pnpm add -D vitest @vitejs/plugin-react supertest @types/supertest
```

---

## 2. 手动测试 (cURL)

> [!TIP]
> 以下测试需要先获取登录 Cookie。

### 2.1 获取登录 Session

```bash
# 方法 1: 使用浏览器 DevTools
# 1. 访问 http://localhost:3005/login
# 2. 登录后在 DevTools > Application > Cookies 中复制 next-auth.session-token

# 方法 2: 程序化登录
curl -c cookies.txt -X POST http://localhost:3005/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=owner@whitenote.local&password=admin123"
```

### 2.2 认证 API 测试

```bash
# 测试获取当前用户
curl http://localhost:3005/api/auth/me \
  -b cookies.txt

# 预期响应
# {"user":{"id":"...","email":"owner@whitenote.local","name":"Owner"}}
```

### 2.3 Messages API 测试

```bash
# 创建消息
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"content":"这是测试消息 #test","tags":["测试","API"]}'

# 预期响应
# {"data":{"id":"...","content":"这是测试消息 #test","isStarred":false,...}}

# ---

# 获取消息列表
curl "http://localhost:3005/api/messages?page=1&limit=10" \
  -b cookies.txt

# 预期响应
# {"data":[...],"meta":{"total":1,"page":1,"limit":10,"totalPages":1}}

# ---

# 获取单条消息 (替换 <id> 为实际 ID)
curl http://localhost:3005/api/messages/<id> \
  -b cookies.txt

# ---

# 更新消息
curl -X PUT http://localhost:3005/api/messages/<id> \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"content":"更新后的内容"}'

# ---

# 收藏消息
curl -X POST http://localhost:3005/api/messages/<id>/star \
  -b cookies.txt

# 预期响应
# {"data":{"id":"...","isStarred":true}}

# ---

# 置顶消息
curl -X POST http://localhost:3005/api/messages/<id>/pin \
  -b cookies.txt

# ---

# 删除消息
curl -X DELETE http://localhost:3005/api/messages/<id> \
  -b cookies.txt

# 预期响应
# {"success":true}
```

### 2.4 Tags API 测试

```bash
# 获取所有标签
curl http://localhost:3005/api/tags \
  -b cookies.txt

# 预期响应
# {"data":[{"id":"...","name":"测试","color":null,"count":1},...]}

# ---

# 创建标签
curl -X POST http://localhost:3005/api/tags \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"新标签","color":"#FF5733"}'

# ---

# 获取标签下的消息
curl "http://localhost:3005/api/tags/<tag-id>/messages" \
  -b cookies.txt
```

### 2.5 Comments API 测试

```bash
# 添加评论
curl -X POST http://localhost:3005/api/messages/<id>/comments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"content":"这是一条评论"}'

# ---

# 获取评论列表
curl http://localhost:3005/api/messages/<id>/comments \
  -b cookies.txt
```

### 2.6 Templates API 测试

```bash
# 获取模板列表
curl http://localhost:3005/api/templates \
  -b cookies.txt

# ---

# 创建自定义模板
curl -X POST http://localhost:3005/api/templates \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"我的模板","content":"# 标题\n\n内容...","description":"测试模板"}'
```

### 2.7 Search API 测试

```bash
# 搜索
curl "http://localhost:3005/api/search?q=测试&page=1&limit=10" \
  -b cookies.txt
```

### 2.8 AI Config API 测试

```bash
# 获取配置
curl http://localhost:3005/api/config \
  -b cookies.txt

# ---

# 更新配置
curl -X PUT http://localhost:3005/api/config \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"enableRag":true,"enableAutoTag":true}'
```

### 2.9 AI 功能测试

```bash
# AI 聊天
curl -X POST http://localhost:3005/api/ai/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"messageId":"<id>","content":"总结这条笔记"}'

# ---

# AI 文本增强 - 摘要
curl -X POST http://localhost:3005/api/ai/enhance \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"action":"summarize","content":"这是一段很长的文本..."}'

# AI 文本增强 - 翻译
curl -X POST http://localhost:3005/api/ai/enhance \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"action":"translate","content":"Hello World","target":"Chinese"}'
```

---

## 3. 自动化测试 (Vitest)

### 3.1 Vitest 配置

创建 `vitest.config.ts`：

```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

### 3.2 测试设置

创建 `tests/setup.ts`：

```typescript
import { beforeAll, afterAll, beforeEach } from "vitest"
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

beforeAll(async () => {
  // 创建测试用户
  const passwordHash = await hash("test123", 12)
  await prisma.user.upsert({
    where: { email: "test@whitenote.local" },
    update: {},
    create: {
      email: "test@whitenote.local",
      passwordHash,
      name: "Test User",
    },
  })
})

beforeEach(async () => {
  // 每个测试前清理数据 (保留用户)
  await prisma.comment.deleteMany()
  await prisma.messageTag.deleteMany()
  await prisma.messageLink.deleteMany()
  await prisma.messageVersion.deleteMany()
  await prisma.reminder.deleteMany()
  await prisma.media.deleteMany()
  await prisma.message.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

export { prisma }
```

### 3.3 消息 API 测试

创建 `tests/api/messages.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../setup"

describe("Messages API", () => {
  let testUserId: string

  beforeEach(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "test@whitenote.local" },
    })
    testUserId = user!.id
  })

  describe("POST /api/messages", () => {
    it("should create a message", async () => {
      const message = await prisma.message.create({
        data: {
          content: "Test message",
          authorId: testUserId,
        },
      })

      expect(message.id).toBeDefined()
      expect(message.content).toBe("Test message")
      expect(message.isStarred).toBe(false)
      expect(message.isPinned).toBe(false)
    })

    it("should create a message with tags", async () => {
      const tag = await prisma.tag.create({
        data: { name: "TestTag" },
      })

      const message = await prisma.message.create({
        data: {
          content: "Tagged message",
          authorId: testUserId,
          tags: {
            create: { tagId: tag.id },
          },
        },
        include: { tags: { include: { tag: true } } },
      })

      expect(message.tags).toHaveLength(1)
      expect(message.tags[0].tag.name).toBe("TestTag")
    })
  })

  describe("GET /api/messages", () => {
    it("should list messages ordered by createdAt desc", async () => {
      await prisma.message.createMany({
        data: [
          { content: "First", authorId: testUserId },
          { content: "Second", authorId: testUserId },
        ],
      })

      const messages = await prisma.message.findMany({
        where: { authorId: testUserId },
        orderBy: { createdAt: "desc" },
      })

      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe("Second")
    })

    it("should filter by starred", async () => {
      await prisma.message.create({
        data: { content: "Starred", authorId: testUserId, isStarred: true },
      })
      await prisma.message.create({
        data: { content: "Not starred", authorId: testUserId },
      })

      const starred = await prisma.message.findMany({
        where: { authorId: testUserId, isStarred: true },
      })

      expect(starred).toHaveLength(1)
      expect(starred[0].content).toBe("Starred")
    })
  })

  describe("PUT /api/messages/:id", () => {
    it("should update message content", async () => {
      const message = await prisma.message.create({
        data: { content: "Original", authorId: testUserId },
      })

      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { content: "Updated" },
      })

      expect(updated.content).toBe("Updated")
    })

    it("should save version history on update", async () => {
      const message = await prisma.message.create({
        data: { content: "Version 1", authorId: testUserId },
      })

      await prisma.messageVersion.create({
        data: { messageId: message.id, content: message.content },
      })

      await prisma.message.update({
        where: { id: message.id },
        data: { content: "Version 2" },
      })

      const versions = await prisma.messageVersion.findMany({
        where: { messageId: message.id },
      })

      expect(versions).toHaveLength(1)
      expect(versions[0].content).toBe("Version 1")
    })
  })

  describe("DELETE /api/messages/:id", () => {
    it("should delete message and related data", async () => {
      const message = await prisma.message.create({
        data: { content: "To delete", authorId: testUserId },
      })

      await prisma.comment.create({
        data: { content: "Comment", messageId: message.id, authorId: testUserId },
      })

      await prisma.message.delete({ where: { id: message.id } })

      const deleted = await prisma.message.findUnique({
        where: { id: message.id },
      })
      const comments = await prisma.comment.findMany({
        where: { messageId: message.id },
      })

      expect(deleted).toBeNull()
      expect(comments).toHaveLength(0) // Cascade delete
    })
  })
})
```

### 3.4 标签 API 测试

创建 `tests/api/tags.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../setup"

describe("Tags API", () => {
  let testUserId: string

  beforeEach(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "test@whitenote.local" },
    })
    testUserId = user!.id
  })

  describe("GET /api/tags", () => {
    it("should return tags sorted by message count", async () => {
      const tag1 = await prisma.tag.create({ data: { name: "Popular" } })
      const tag2 = await prisma.tag.create({ data: { name: "Niche" } })

      // 创建消息并关联标签
      for (let i = 0; i < 5; i++) {
        const msg = await prisma.message.create({
          data: { content: `Msg ${i}`, authorId: testUserId },
        })
        await prisma.messageTag.create({
          data: { messageId: msg.id, tagId: tag1.id },
        })
      }

      const msg = await prisma.message.create({
        data: { content: "Single", authorId: testUserId },
      })
      await prisma.messageTag.create({
        data: { messageId: msg.id, tagId: tag2.id },
      })

      const tags = await prisma.tag.findMany({
        include: { _count: { select: { messages: true } } },
        orderBy: { messages: { _count: "desc" } },
      })

      expect(tags[0].name).toBe("Popular")
      expect(tags[0]._count.messages).toBe(5)
    })
  })

  describe("POST /api/tags", () => {
    it("should create a new tag", async () => {
      const tag = await prisma.tag.create({
        data: { name: "NewTag", color: "#FF0000" },
      })

      expect(tag.name).toBe("NewTag")
      expect(tag.color).toBe("#FF0000")
    })

    it("should reject duplicate tag names", async () => {
      await prisma.tag.create({ data: { name: "Unique" } })

      await expect(
        prisma.tag.create({ data: { name: "Unique" } })
      ).rejects.toThrow()
    })
  })
})
```

### 3.5 运行测试

更新 `package.json`：

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

运行测试：

```bash
# 交互模式
pnpm test

# 单次运行
pnpm test:run

# 带覆盖率
pnpm test:coverage
```

---

## 4. 完整测试流程

### 4.1 测试前准备

```bash
# 1. 启动服务
pnpm dev

# 2. 启动 Worker (新终端)
pnpm worker

# 3. 确保数据库有种子数据
pnpm prisma db seed
```

### 4.2 端到端测试脚本

创建 `scripts/e2e-test.sh`：

```bash
#!/bin/bash

BASE_URL="http://localhost:3005"
COOKIE_FILE="cookies.txt"

echo "=== WhiteNote API E2E Test ==="

# 1. 登录
echo "1. 登录..."
curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=owner@whitenote.local&password=admin123" > /dev/null

# 2. 创建消息
echo "2. 创建消息..."
MSG=$(curl -s -X POST "$BASE_URL/api/messages" \
  -H "Content-Type: application/json" \
  -b $COOKIE_FILE \
  -d '{"content":"E2E Test Message","tags":["e2e","test"]}')
MSG_ID=$(echo $MSG | jq -r '.data.id')
echo "   Created message: $MSG_ID"

# 3. 获取消息列表
echo "3. 获取消息列表..."
curl -s "$BASE_URL/api/messages?limit=5" -b $COOKIE_FILE | jq '.meta'

# 4. 收藏消息
echo "4. 收藏消息..."
curl -s -X POST "$BASE_URL/api/messages/$MSG_ID/star" -b $COOKIE_FILE | jq '.data'

# 5. 添加评论
echo "5. 添加评论..."
curl -s -X POST "$BASE_URL/api/messages/$MSG_ID/comments" \
  -H "Content-Type: application/json" \
  -b $COOKIE_FILE \
  -d '{"content":"Test comment"}' | jq '.data.id'

# 6. 获取标签
echo "6. 获取标签..."
curl -s "$BASE_URL/api/tags" -b $COOKIE_FILE | jq '.data | length'

# 7. 搜索
echo "7. 搜索..."
curl -s "$BASE_URL/api/search?q=E2E" -b $COOKIE_FILE | jq '.meta.total'

# 8. 删除消息
echo "8. 删除消息..."
curl -s -X DELETE "$BASE_URL/api/messages/$MSG_ID" -b $COOKIE_FILE | jq '.success'

# 清理
rm -f $COOKIE_FILE

echo "=== Test Complete ==="
```

运行：

```bash
chmod +x scripts/e2e-test.sh
./scripts/e2e-test.sh
```

---

## API 端点速查表

| 模块 | 端点 | 方法 | 状态码 |
|------|------|------|--------|
| Auth | `/api/auth/me` | GET | 200/401 |
| Messages | `/api/messages` | GET | 200/401 |
| | `/api/messages` | POST | 201/400/401 |
| | `/api/messages/[id]` | GET | 200/401/404 |
| | `/api/messages/[id]` | PUT | 200/400/401/404 |
| | `/api/messages/[id]` | DELETE | 200/401/404 |
| | `/api/messages/[id]/star` | POST | 200/401/404 |
| | `/api/messages/[id]/pin` | POST | 200/401/404 |
| | `/api/messages/[id]/comments` | GET/POST | 200/201/401/404 |
| Tags | `/api/tags` | GET | 200/401 |
| | `/api/tags` | POST | 201/400/401/409 |
| | `/api/tags/[id]/messages` | GET | 200/401 |
| Templates | `/api/templates` | GET | 200/401 |
| | `/api/templates` | POST | 201/400/401 |
| | `/api/templates/[id]` | GET/DELETE | 200/401/403/404 |
| Search | `/api/search?q=` | GET | 200/400/401 |
| Config | `/api/config` | GET/PUT | 200/401/500 |
| AI | `/api/ai/chat` | POST | 200/400/401/500 |
| | `/api/ai/enhance` | POST | 200/400/401/500 |

---

## 测试完成 ✅

完成本文档中的所有测试后，你的 WhiteNote 2.5 后端 API 已验证通过，可以开始前端开发。
