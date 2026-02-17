# AI Chat 功能实现文档

## 概述

本文档说明如何在 WhiteNote 中集成 OpenClaw 作为 AI 对话后端，实现类似 ChatGPT 的 Web UI 对话界面。

## 更新日志

### 2026-02-17: 修复 SSE 流式更新错误的 assistant 消息

**问题**: SSE 流式更新时，会错误地更新历史记录中的 assistant 消息，导致用户消息上方显示一条旧的 assistant 消息内容。

**原因分析**:
1. SSE `onChunk` 回调查找"最后一个 assistant 消息"来更新
2. 如果历史记录中有旧消息，会错误地更新它而不是当前会话的新消息
3. 轮询获取多条 assistant 消息后，刷新页面才显示正确

**解决方案**:

1. **添加 pending 消息占位符** (`ChatWindow.tsx`):
   ```tsx
   const pendingAssistantIdRef = useRef<string | null>(null)

   // 发送消息时创建临时占位符
   const pendingAssistantId = `pending-${userTimestamp}`
   const pendingAssistantMessage: ChatMessage = {
     id: pendingAssistantId,
     role: 'assistant',
     content: '',
     timestamp: userTimestamp + 1,
   }
   setMessages(prev => [...prev, userMessage, pendingAssistantMessage])
   pendingAssistantIdRef.current = pendingAssistantId
   ```

2. **SSE onChunk 只更新 pending 消息**:
   ```tsx
   (_delta, fullContent, contentBlocks) => {
     const pendingId = pendingAssistantIdRef.current
     if (!pendingId) return
     
     // 只更新 pending 消息（通过 ID 匹配）
     setMessages(prev =>
       prev.map(msg => {
         if (msg.id === pendingId && msg.role === 'assistant') {
           return {
             ...msg,
             content: fullContent,
             thinkingBlocks: ...,
             contentBlocks: ...,
           }
         }
         return msg
       })
     )
   }
   ```

3. **轮询和 onFinish 移除 pending 消息**:
   ```tsx
   // 轮询获取真实消息后，移除 pending 消息
   const assistantMsgs = await openclawApi.getAssistantMessages(...)
   setMessages(prev => {
     const beforePending = prev.slice(0, userIdx + 1).filter(m => !m.id.startsWith('pending-'))
     const newMessages = assistantMsgs.map(...)
     return [...beforePending, ...newMessages]
   })
   ```

4. **新增 getAssistantMessages API** (`api.ts`):
   - 返回多条 assistant 消息（不合并）
   - 正确匹配 toolResult 到对应的 toolCall
   - 按时间顺序排列

**效果**:
- SSE 流式更新不再错误地更新历史消息
- 用户消息上方不会出现错误的旧内容
- 轮询获取多条 assistant 消息后，立即正确显示（无需刷新）

### 2026-02-17: 优化轮询间隔

**问题**: 轮询延迟 3 秒才开始，间隔 3 秒，导致 thinking/toolCall 内容显示不够及时。

**解决方案**:
- 移除 3 秒延迟，立即开始轮询
- 缩短轮询间隔从 3 秒改为 1 秒

**效果**:
- thinking/toolCall 内容更快显示
- 长任务时用户能更快看到进度

### 2026-02-17: 优化 thinking/toolCall 流式显示

**问题**: 流式回复时，thinking 和 toolCall 内容不够实时，用户需要等待较长时间才能看到这些内容。

**原因分析**:
1. OpenClaw Gateway 的 `agent` 事件不发送 thinking 和 toolCall（只发送 `assistant` 文本流）
2. SSE 只收到纯文本内容，thinking/toolCall 需要通过轮询历史记录获取

**解决方案**: 
- 立即开始轮询（1 秒间隔）获取 thinking/toolCall
- SSE 流式显示文本内容，轮询补充 thinking/toolCall

**效果**:
- thinking 内容通过轮询较快显示
- toolCall 一旦生成就通过轮询显示
- 文本内容通过 SSE 实时流式显示

### 2026-02-17: 修复用户消息消失和流式内容问题

**问题 1: 用户消息发送后消失**

**原因分析**:
1. **轮询闭包问题**: `setTimeout` 和 `setInterval` 中的回调函数捕获了旧的 `isLoading` 状态值，导致轮询在 `onFinish` 后仍继续执行
2. **轮询清除时序问题**: `onFinish` 中清除轮询时，`pollingRef.current` 可能还是 `null`（因为 `setTimeout` 还没执行），所以 `clearInterval` 无效
3. **用户消息渲染问题**: `AIMessageViewer` 中的 `hasTextBlocks` 检查对于用户消息（纯字符串内容）返回 `false`，导致 `EditorContent` 不渲染

**解决方案**:

1. **ChatWindow.tsx - 修复轮询闭包问题**:
   ```tsx
   // 添加 ref 跟踪状态，避免闭包问题
   const currentAssistantIdRef = useRef<string | null>(null)
   const isLoadingRef = useRef(false)
   const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

   // 清除所有轮询的辅助函数
   const clearAllPolling = useCallback(() => {
     if (pollingRef.current) {
       clearInterval(pollingRef.current)
       pollingRef.current = null
     }
     if (pollingTimeoutRef.current) {
       clearTimeout(pollingTimeoutRef.current)
       pollingTimeoutRef.current = null
     }
   }, [])
   ```

2. **AIMessageViewer.tsx - 修复用户消息渲染**:
   ```tsx
   // 修复前：用户消息（纯字符串）不渲染
   {hasTextBlocks && textContent && <EditorContent editor={editor} />}

   // 修复后：用户消息也能正确渲染
   const shouldRenderText = hasTextBlocks || (typeof message.content === 'string' && message.content.trim() !== '')
   {shouldRenderText && textContent && <EditorContent editor={editor} />}
   ```

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
   - 实时更新 UI
   - 流式完成后自动调用获取完整消息数据

3. **ChatWindow 组件更新** (`ChatWindow.tsx`):
   - 使用 `sendMessageStream()` 替代轮询
   - AI 回答完成后立即允许发送新消息
   - 流式完成后自动获取完整消息（包括 thinking blocks 和 tool calls）

4. **关键实现细节**:
   - 事件名是 `chat` 而不是 `chat.broadcast`
   - sessionKey 可能是 `agent:main:main` 格式，需要灵活匹配
   - 不需要调用 `chat.subscribe`（该方法不存在）

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
| `src/app/api/openclaw/chat/history/route.ts` | 聊天历史 API |

### 后端 - 核心文件

| 文件 | 说明 |
|------|------|
| `src/app/api/openclaw/sessions/route.ts` | 会话管理 API |
| `src/app/api/openclaw/chat/stream/route.ts` | 流式聊天 API (SSE) |

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
- 创建 `pending-{timestamp}` ID 的占位符消息，避免错误更新历史消息

### 4. 消息渲染 (AIMessageViewer.tsx)

专门为 AI Chat 设计的精简版 Markdown 查看器，特点：
- 移除图片灯箱点击功能
- 移除消息折叠/行数限制
- 保留表格功能
- 保留代码块语法高亮和复制按钮
- 保留基本 Markdown 样式（标题、列表、链接、引用等）

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

// 获取多条 assistant 消息
openclawApi.getAssistantMessages(sessionKey, afterTimestamp)  // 返回多条消息，不合并

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

## 扩展

如需扩展功能，可以考虑：
- 支持多会话（通过 sessionKey 管理）
- 会话历史（通过 `chat.history` API）
- 文件上传（通过 attachments 参数）
- 自定义 Agent（通过 label 参数）
