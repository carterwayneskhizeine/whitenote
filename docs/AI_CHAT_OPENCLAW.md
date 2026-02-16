# AI Chat 功能实现文档

## 概述

本文档说明如何在 WhiteNote 中集成 OpenClaw 作为 AI 对话后端，实现类似 ChatGPT 的 Web UI 对话界面。

## 更新日志

### 2026-02-15: 设备身份认证 + 历史记录

成功实现 OpenClaw 设备身份认证，解决历史记录权限问题：

**问题**: 早期实现使用共享 token 认证，无法获取聊天历史记录，报错 "missing scope: operator.read"

**解决方案**: 实现完整的设备身份认证系统（Ed25519 密钥对 + 签名）

**核心改动**:

1. **新增设备身份模块**:
   - `src/lib/openclaw/deviceIdentity.ts` - Ed25519 密钥对生成、签名
   - `src/lib/openclaw/deviceAuthStore.ts` - 设备 token 存储

2. **WebSocket 客户端升级** (`gateway.ts`):
   - 加载或创建设备身份 (`~/.openclaw/identity/device.json`)
   - 构建设备认证 payload 并签名
   - 发送设备信息（id, publicKey, signature, signedAt, nonce）
   - 存储网关返回的设备 token 用于后续连接

3. **请求权限 scopes**:
   - `operator.admin` - 管理员权限
   - `operator.read` - 读取聊天历史
   - `operator.write` - 发送消息

4. **前端历史记录加载** (`ChatWindow.tsx`):
   - 页面加载时调用 `/api/openclaw/chat/history` API
   - 将历史消息转换为本地格式并显示

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

### 2026-02-17: SSE 流式传输实现

改用 SSE (Server-Sent Events) 流式传输，利用 OpenClaw Gateway 的 WebSocket 事件推送，实现真正的实时流式响应：

**核心改动**:

1. **新增 `/api/openclaw/chat/stream` 接口** - SSE 流式响应
   - 监听 OpenClaw Gateway 的 `chat` 事件和 `agent` 事件
   - 将 WebSocket 事件实时转换为 SSE 格式推送给前端
   - 支持 `delta`（增量内容）、`final`（完成）、`error`（错误）事件
   - 超时时间设置为 10 分钟，支持长时间任务

2. **前端 SSE 客户端** (`api.ts`):
   - 使用 Fetch API + ReadableStream 读取 SSE 流
   - 实时更新 UI，每 50ms 检查一次
   - 流式完成后自动调用 `getLastCompleteResponse()` 获取完整数据

3. **ChatWindow 组件更新** (`ChatWindow.tsx`):
   - 使用 `sendMessageStream()` 替代轮询
   - AI 回答完成后立即允许发送新消息
   - 流式完成后自动获取完整消息（包括 thinking blocks 和 tool calls）

4. **关键实现细节**:
   - 事件名是 `chat` 而不是 `chat.broadcast`
   - sessionKey 可能是 `agent:main:main` 格式，需要灵活匹配
   - 不需要调用 `chat.subscribe`（该方法不存在）

### 2026-02-17: 消息按时间顺序渲染

**问题**: 之前的实现将所有 thinking blocks 合并在一起渲染，然后是所有 toolCalls，最后是 toolResults 和文本。这与刷新页面后看到的效果不一致。

**原因分析**: 通过日志分析发现，历史记录中的消息是按时间顺序排列的：
- 第一条 assistant 消息：thinking → toolCall
- toolResult 消息
- 第二条 assistant 消息：thinking → text

**解决方案**:

1. **修改 `pollMessage` 方法** (`api.ts`):
   - 按时间戳排序相关消息
   - 按原始顺序保留所有 content blocks（不按类型分组）
   - 使用 `pendingToolCalls` 数组跟踪未匹配的 tool calls

2. **修改 `AIMessageViewer` 组件** (`AIMessageViewer.tsx`):
   - 不再单独渲染 thinkingBlocks
   - 直接按 `contentBlocks` 数组的顺序渲染所有 blocks
   - thinking → toolCall → toolResult → text 按原始顺序显示

**渲染效果**:
```
Thinking    reasoning_content
用户要求使用 Bash 计算 3 * 3 * 3 * 999...

🔧 Tool Call: exec
Command: echo $((3 * 3 * 3 * 999))

Tool Result: exec
512

Thinking    reasoning_content
计算结果是 26973，正确。

Text (最终回复)
```

这与刷新页面后看到的效果完全一致。

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

## 消息流程 (SSE 流式)

1. 用户在前端输入消息，发送到 `/api/openclaw/chat/stream`
2. 后端通过 WebSocket 连接到 OpenClaw Gateway
3. 发送消息到 `main` 会话
4. 后端监听 Gateway 的 `chat` 事件
5. 收到 `delta` 事件时，将增量内容通过 SSE 推送给前端
6. 收到 `final` 事件时，发送完成信号并关闭 SSE 连接
7. 前端实时更新 UI，完成后重新加载历史记录获取完整数据

### SSE 事件格式

```
data: {"type":"start","sessionKey":"main"}

data: {"type":"content","runId":"...","delta":"部分内容","content":"部分内容"}

data: {"type":"finish","runId":"...","usage":{...},"stopReason":"..."}
```

## 关键文件

### 后端 - OpenClaw 集成

| 文件 | 说明 |
|------|------|
| `src/lib/openclaw/types.ts` | OpenClaw 协议类型定义 |
| `src/lib/openclaw/gateway.ts` | WebSocket 客户端 (设备身份认证) |
| `src/lib/openclaw/deviceIdentity.ts` | Ed25519 设备身份模块 |
| `src/lib/openclaw/deviceAuthStore.ts` | 设备 token 存储模块 |
| `src/app/api/openclaw/sessions/route.ts` | 会话管理 API |
| `src/app/api/openclaw/chat/stream/route.ts` | 流式聊天 API (SSE) |
| `src/app/api/openclaw/chat/send/route.ts` | 伪流式发送 API (立即返回) |
| `src/app/api/openclaw/chat/history/route.ts` | 聊天历史 API |

### 后端 - 核心文件

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
- 支持**设备身份认证** (Ed25519 密钥对 + 签名)
- 处理连接、认证、重连、心跳

关键方法：
- `start()` - 启动连接
- `stop()` - 停止连接
- `sendMessage(sessionKey, content)` - 发送消息
- `chatHistory(sessionKey, limit)` - 获取聊天历史
- `sessionsResolve(params)` - 解析会话
- `onEvent` - 事件回调

### 设备身份认证流程

```
1. 客户端启动连接
   ↓
2. 网关发送 connect.challenge (包含 nonce)
   ↓
3. 客户端发送 connect 请求:
   - role: "operator"
   - scopes: ["operator.admin", "operator.read", "operator.write"]
   - auth: { token: 设备token }
   - device: {
       id: 设备ID (公钥指纹),
       publicKey: Base64URL 编码的公钥,
       signature: 签名的 payload,
       signedAt: 时间戳,
       nonce: 网关提供的 nonce
     }
   ↓
4. 网关验证:
   - 验证设备签名
   - 验证设备 token
   - 检查 scopes 权限
   - 返回 hello-ok (包含新的 deviceToken)
   ↓
5. 客户端存储 deviceToken 用于下次连接
```

### 设备身份文件位置

| 文件 | 说明 |
|------|------|
| `~/.openclaw/identity/device.json` | 设备 Ed25519 密钥对 |
| `~/.openclaw/identity/device-auth.json` | 设备 token (自动存储) |
| `~/.openclaw/devices/paired.json` | 已配对设备信息 |

### 2. 流式聊天 API (chat/stream/route.ts)

- POST 接口，接收 `sessionKey` 和 `content`
- 创建全局 Gateway 实例并连接
- 监听 `chat` 事件获取流式回复
- 将事件转换为 SSE 格式返回给前端
- 支持 10 分钟超时，适合长时间任务

### 3. 前端 (ChatWindow.tsx) - SSE 流式

- 使用 `sendMessageStream()` 方法
- 通过 `onChunk` 回调实时更新 UI
- 通过 `onFinish` 回调重新加载历史记录
- AI 回答完成后立即允许发送新消息

```tsx
await openclawApi.sendMessageStream(
  sessionKey,
  content,
  // onChunk: 每次收到增量内容时调用
  (delta, fullContent) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: fullContent }
          : msg
      )
    )
  },
  // onFinish: 流式传输完成时调用
  () => {
    setIsLoading(false)
    // 重新加载历史记录获取完整数据
    openclawApi.getHistory(sessionKey).then(history => {
      // 更新完整消息（包括 thinking blocks）
    })
  },
  // onError: 发生错误时调用
  (error) => {
    setError(error)
  }
)
```

### 4. 发送 API (chat/send/route.ts) - 保留用于轮询场景

- POST 接口，接收 `sessionKey` 和 `content`
- 发送消息后**立即返回**，不等待 AI 响应
- 返回 `{ success: true, timestamp: number }`
- 适用于某些特殊场景

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
// SSE 流式 API (主要使用)
openclawApi.sendMessageStream(
  sessionKey,
  content,
  onChunk,      // (delta: string, fullContent: string) => void
  onFinish,     // () => void
  onError       // (error: string) => void
)

// 伪流式 API (保留用于特殊场景)
openclawApi.sendMessage(sessionKey, content)  // 发送消息，立即返回
openclawApi.pollMessage(sessionKey, afterTimestamp)  // 轮询获取最新助手消息

// 其他 API
openclawApi.getHistory(sessionKey, limit)  // 获取聊天历史
openclawApi.createSession(label)  // 创建会话
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
5. **事件名**: OpenClaw 使用 `chat` 事件而不是 `chat.broadcast`
6. **sessionKey 匹配**: 事件中的 sessionKey 可能是 `agent:main:main` 格式，需要灵活匹配
7. **超时时间**: SSE 流式传输默认超时 10 分钟，适合长时间任务
8. **调试**: 服务器日志会显示超时和完成状态，前端控制台会显示错误

## 设备认证故障排除

### 问题: "missing scope: operator.read"

**原因**: 使用共享 token 认证时，网关会清除 scopes 权限

**解决**: 实现设备身份认证（Ed25519 密钥对 + 签名）

### 问题: "device token mismatch"

**原因**: 设备 token 无效或过期

**解决**: 删除本地 token 文件，让系统重新配对：
```bash
rm ~/.openclaw/identity/device-auth.json
rm ~/.openclaw/devices/paired.json
```
重启 WhiteNote 和 OpenClaw Gateway，系统会自动重新配对。

### 查看设备配对状态

```bash
# 查看已配对设备
cat ~/.openclaw/devices/paired.json

# 查看设备 token
cat ~/.openclaw/identity/device-auth.json

# 查看设备密钥
cat ~/.openclaw/identity/device.json
```

### 日志调试

在 `gateway.ts` 中添加了详细的调试日志：
- `[OpenClawGateway] Connect params:` - 连接参数
- `[OpenClawGateway] Auth info:` - 网关返回的认证信息
- `[OpenClaw Chat History]` - 历史记录 API 调用日志

## 扩展

如需扩展功能，可以考虑：
- 支持多会话（通过 sessionKey 管理）
- 会话历史（通过 `chat.history` API）
- 文件上传（通过 attachments 参数）
- 自定义 Agent（通过 label 参数）
