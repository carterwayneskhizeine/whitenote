# AI Chat 功能实现文档

## 概述

本文档说明如何在 WhiteNote 中集成 OpenClaw 作为 AI 对话后端，实现类似 ChatGPT 的 Web UI 对话界面。

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
| `src/lib/openclaw/types.ts` | OpenClaw 协议类型定义 |
| `src/lib/openclaw/gateway.ts` | WebSocket 客户端实现 |
| `src/app/api/openclaw/sessions/route.ts` | 会话管理 API |
| `src/app/api/openclaw/chat/stream/route.ts` | 流式聊天 API |

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

SSE 事件格式：
```
event: start
data: {sessionKey: "main"}

event: content
data: {delta: "回复内容"}

event: finish
data: {usage: {...}, stopReason: "..."}
```

### 3. 前端 (ChatWindow.tsx)

- 使用 `openclawApi.sendMessageStream()` 发送消息
- 使用 AsyncGenerator 迭代 SSE 事件
- 实时更新消息列表
- 显示加载动画
- 使用 `AIMessageViewer` 渲染 Markdown 消息内容

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
