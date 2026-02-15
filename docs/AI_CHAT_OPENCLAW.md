# AI Chat 功能实现文档

## 概述

本文档说明如何在 WhiteNote 中集成 OpenClaw 作为 AI 对话后端，实现类似 ChatGPT 的 Web UI 对话界面。

## 更新日志

### 2026-02-15: 伪流式实现

由于移动端 SSE 流式传输在某些网络环境下不稳定，改为 5 秒轮询的伪流式实现：

**核心改动**:

1. **新增 `/api/openclaw/chat/send` 接口** - 发送消息后立即返回，不等待 AI 响应

2. **前端轮询机制** (`ChatWindow.tsx`):
   - 发送消息后每 5 秒轮询一次 `/chat/history`
   - 获取最新助手消息与本地对比
   - 内容变化时更新 UI
   - 连续 15 秒（15 次轮询）无新内容时结束

3. **强制渲染更新**:
   - `AIMessageViewer` 添加 `key` 属性确保内容变化时重新渲染
   ```tsx
   key={`${message.id}-${message.content.slice(0, 20)}`}
   ```

4. **API 适配** (`api.ts`):
   - `sendMessage()`: 发送消息，返回 messageId
   - `pollMessage()`: 获取最新助手消息
   - 客户端过滤：只返回 `role: 'assistant'` 且时间戳大于用户消息的消息

## 架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Web 浏览器 (前端)                                                       │
│  /aichat 页面 → ChatWindow 组件                                         │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP + SSE
┌─────────────────────────────▼───────────────────────────────────────────┐
│  WhiteNote 后端 (Next.js)                                               │
│  /api/openclaw/chat/stream → OpenClawGateway WebSocket 客户端           │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ WebSocket (ws://localhost:18789)
┌─────────────────────────────▼───────────────────────────────────────────┐
│  OpenClaw Gateway                                                       │
│  处理对话，连接 OpenClaw Agent                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 消息流程

1. 用户在前端输入消息，发送到 `/api/openclaw/chat/stream`
2. 后端通过 WebSocket 连接到 OpenClaw Gateway
3. 发送消息到 `main` 会话
4. OpenClaw Gateway 通过 WebSocket 事件流返回回复
5. 后端将事件转换为 SSE 格式返回给前端
6. 前端实时更新 UI

## 关键文件

### 后端

| 文件 | 说明 |
|------|------|
| `src/app/api/openclaw/sessions/route.ts` | 会话管理 API |
| `src/app/api/openclaw/chat/stream/route.ts` | 流式聊天 API (SSE) |
| `src/app/api/openclaw/chat/send/route.ts` | 伪流式发送 API (立即返回) |

### 前端

| 文件 | 说明 |
|------|------|
| `src/components/OpenClawChat/types.ts` | 前端类型定义 |
| `src/components/OpenClawChat/api.ts` | API 客户端 |
| `src/components/OpenClawChat/ChatWindow.tsx` | 对话主组件 |
| `src/components/OpenClawChat/AIMessageViewer.tsx` | AI 消息 Markdown 查看器（精简版） |
| `src/app/aichat/page.tsx` | AI Chat 页面 |

## 配置

在 `.env.local` 中添加：

```env
# OpenClaw Gateway 配置
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_TOKEN=your-token-here
```

## 实现细节

### 1. WebSocket 客户端 (gateway.ts)

核心类 `OpenClawGateway`：
- 连接到 OpenClaw Gateway (默认 ws://localhost:18789)
- 使用 `webchat-ui` 作为 client ID，`webchat` 作为 mode
- 通过 Origin header 通过 Origin 检查
- 支持 token 认证
- 处理连接、认证、重连、心跳

关键方法：
- `start()` - 启动连接
- `stop()` - 停止连接
- `sendMessage(sessionKey, content)` - 发送消息
- `sessionsResolve(params)` - 解析会话
- `onEvent` - 事件回调

### 2. 聊天 API (chat/stream/route.ts)

- POST 接口，接收 `sessionKey` 和 `content`
- 创建全局 Gateway 实例并连接
- 监听 `agent` 事件获取流式回复
- 使用 SSE 编码返回给前端

### 3. 发送 API (chat/send/route.ts) - 伪流式

- POST 接口，接收 `sessionKey` 和 `content`
- 发送消息后**立即返回**，不等待 AI 响应
- 返回 `{ success: true, timestamp: number }`
- 适用于轮询场景

SSE 事件格式：
```
event: start
data: {sessionKey: "main"}

event: content
data: {delta: "回复内容"}

event: finish
data: {usage: {...}, stopReason: "..."}
```

### 3. 前端 (ChatWindow.tsx) - 伪流式

- 发送消息到 `/chat/send`，立即返回
- 每 5 秒轮询 `/chat/history` 获取最新消息
- 使用 `key` 属性强制 TipTap 重新渲染更新内容
- 连续 3 次轮询无变化时结束

```tsx
const pollForResponse = async () => {
  const latestMsg = await openclawApi.pollMessage(sessionKey, userTimestamp)
  
  if (latestMsg && latestMsg.content !== lastContent) {
    lastContent = latestMsg.content
    setMessages(prev => prev.map(msg => 
      msg.id === assistantMessageId 
        ? { ...msg, content: latestMsg.content }
        : msg
    ))
  }
  
  if (consecutiveEmpty < maxEmptyRounds) {
    setTimeout(pollForResponse, 5000)
  } else {
    setIsLoading(false)
  }
}
```

### 4. 消息渲染 (AIMessageViewer.tsx)

专门为 AI Chat 设计的精简版 Markdown 查看器，特点：
- 移除图片灯箱点击功能
- 移除消息折叠/行数限制
- 保留表格功能
- 保留代码块语法高亮和复制按钮
- 保留基本 Markdown 样式（标题、列表、链接、引用等）

接口：
```tsx
interface AIMessageViewerProps {
  content: string      // Markdown 内容
  className?: string   // 额外样式类
}
```

### 5. 前端 API (api.ts)

```ts
// 伪流式 API
openclawApi.sendMessage(sessionKey, content)  // 发送消息，立即返回
openclawApi.pollMessage(sessionKey, afterTimestamp)  // 轮询获取最新助手消息

// 流式 API (保留)
openclawApi.sendMessageStream(sessionKey, content)  // SSE 流式响应
```

## 依赖

需要在 `package.json` 中添加：

```json
{
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.18.0"
  }
}
```

## 测试

1. 确保 OpenClaw Gateway 运行在 `ws://localhost:18789`
2. 配置 `OPENCLAW_TOKEN`
3. 启动 WhiteNote: `pnpm build && pnpm dev`
4. 访问 `http://localhost:3005/aichat`

## 注意事项

1. **Origin 检查**: OpenClaw Gateway 默认检查 Origin，需要在 WebSocket 连接时设置正确的 Origin header
2. **Client ID**: 必须使用 Gateway 允许的 client ID (如 `webchat-ui`)
3. **Mode**: 必须使用 `webchat` mode 才能通过 Origin 检查
4. **会话**: 使用默认的 `main` 会话，无需提前创建
5. **SSE 解析**: 前端需要正确解析 SSE 的 `event:` 和 `data:` 行

## 扩展

如需扩展功能，可以考虑：
- 支持多会话（通过 sessionKey 管理）
- 会话历史（通过 `chat.history` API）
- 文件上传（通过 attachments 参数）
- 自定义 Agent（通过 label 参数）
