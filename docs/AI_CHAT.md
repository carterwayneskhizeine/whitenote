# WhiteNote AI Chat 功能文档

## 概述

WhiteNote AI Chat 是一个完整的 AI 对话界面，通过 **OpenClaw Gateway** 作为后端，提供类似 ChatGPT 的体验。它支持流式响应、实时显示 AI 思考过程、工具调用可视化等功能。

### 核心特性

- **流式响应**: SSE (Server-Sent Events) 实现实时 AI 输出
- **思考过程可视化**: 显示 AI 的 reasoning/thinking 过程
- **工具调用可视化**: 实时显示工具执行过程和结果
- **富文本渲染**: 基于 TipTap 的 Markdown 渲染，支持代码高亮
- **消息持久化**: localStorage 保存聊天历史，刷新后自动恢复
- **移动端适配**: 检测键盘状态，动态调整布局
- **设备认证**: 公私钥签名机制，支持 token 持久化

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        WhiteNote 前端                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐    │
│  │ aichat/      │  │ ChatWindow.tsx   │  │ AIMessage    │    │
│  │ page.tsx     │◄─┤ (主聊天组件)      │◄─┤ Viewer.tsx   │    │
│  │ (页面入口)    │  └──────────────────┘  │ (消息渲染)   │    │
│  └──────────────┘                       └──────────────┘    │
│         ▲                                           │         │
│         │                                           ▼         │
│  ┌──────────────┐                           ┌──────────────┐  │
│  │ api.ts       │                           │ api/openclaw/ │  │
│  │ (前端 API    │───────────────────────────▶│ 路由层        │  │
│  │  客户端)     │                           │              │  │
│  └──────────────┘                           └──────────────┘  │
│                                                   │             │
└───────────────────────────────────────────────────┼─────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API 层                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ /api/openclaw/chat/     │  │ /api/openclaw/chat/     │      │
│  │ stream/route.ts        │  │ history/route.ts       │      │
│  │ (SSE 流式响应)          │  │ (获取历史消息)         │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                    │                           │                │
│                    └─────────────┬─────────────┘                │
│                                  ▼                              │
│  ┌─────────────────────────────────────────────┐                │
│  │ lib/openclaw/gateway.ts                    │                │
│  │ (WebSocket 客户端)                         │                │
│  └─────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   OpenClaw Gateway (外部服务)                     │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket: ws://localhost:18789                                │
│  认证: OPENCLAW_TOKEN (环境变量)                                │
└─────────────────────────────────────────────────────────────────┘
```

### 文件结构

```
WhiteNote AI Chat
│
├── 页面层
│   └── src/app/aichat/page.tsx
│       ├── 处理 Visual Viewport API (键盘检测)
│       ├── 移动端/桌面端自适应
│       └── 渲染 ChatWindow 组件
│
├── 组件层
│   └── src/components/OpenClawChat/
│       ├── ChatWindow.tsx          # 主聊天窗口组件
│       ├── AIMessageViewer.tsx     # 消息渲染器 (TipTap)
│       ├── api.ts                  # 前端 API 客户端
│       └── types.ts                # TypeScript 类型定义
│
├── API 路由层
│   └── src/app/api/openclaw/
│       ├── chat/stream/route.ts    # SSE 流式聊天 API
│       ├── chat/history/route.ts   # 获取聊天历史 API
│       └── sessions/route.ts      # 会话管理 API
│
└── 网关层
    └── src/lib/openclaw/
        ├── gateway.ts              # WebSocket 客户端实现
        ├── types.ts                # OpenClaw 协议类型
        ├── deviceIdentity.ts       # 设备身份管理
        └── deviceAuthStore.ts      # 设备认证存储
```

---

## 核心技术实现

### 1. WebSocket 通信

#### 协议版本

```typescript
export const OPENCLAW_PROTOCOL_VERSION = 3;
```

#### 连接流程

```
1. WebSocket 连接到 ws://localhost:18789
   ↓
2. 等待 connect.challenge 事件 (带 nonce)
   ↓
3. 发送 connect 请求:
   - 设备身份 (deviceId, publicKey, signature)
   - 客户端信息 (id, version, platform, mode)
   - 认证信息 (token 或 deviceToken)
   ↓
4. 接收 hello-ok 响应:
   - 服务器版本信息
   - deviceToken (持久化存储)
   - 功能列表 (methods, events)
   ↓
5. 连接成功，开始通信
```

#### 设备认证机制

每个客户端生成唯一的设备身份：

```typescript
// 设备身份结构
interface DeviceIdentity {
  deviceId: string;        // 唯一设备 ID
  privateKeyPem: string;    // 私钥
  publicKeyPem: string;     // 公钥
  createdAt: number;        // 创建时间
}

// 认证流程
1. 生成设备身份 (首次运行时)
2. 构建认证 payload:
   {
     deviceId, clientId, clientMode,
     role, scopes,
     signedAtMs, token, nonce
   }
3. 使用私钥签名 payload
4. 发送 connect 请求
5. 接收 deviceToken 并持久化到 localStorage
6. 下次连接优先使用 deviceToken
```

**认证回退机制:**
- 如果 `deviceToken` 失效，自动清除并回退到共享 token (`OPENCLAW_TOKEN`)
- 支持自动重新认证

---

### 2. SSE 流式响应

#### 前端 SSE 事件类型

```typescript
type SSEEvent =
  | { type: 'start', sessionKey: string }              // 流开始
  | { type: 'content', contentBlocks: [...], incremental?: boolean }
  | { type: 'finish', runId: string, usage?, stopReason? } // 流结束
  | { type: 'error', error: string }                    // 错误
```

#### 增量累积策略

```typescript
// 思考块和工具调用块 - 前端累积
const accumulatedBlocks: ContentBlock[] = []

// 收到新块时
if (event.stream === 'thinking' || event.stream === 'toolCall') {
  accumulatedBlocks.push(newBlock)
  sendEvent({
    type: 'content',
    contentBlocks: [...accumulatedBlocks],
    incremental: true  // 标记为增量数据
  })
}

// 文本块 (chat delta) - 后端发送完整内容
if (event.stream === 'assistant') {
  sendEvent({
    type: 'content',
    contentBlocks: allBlocks  // 包含 thinking + toolCall + text
  })
}
```

#### 前端处理流程

```typescript
await openclawApi.sendMessageStream(
  sessionKey,
  content,
  (delta, fullContent, contentBlocks) => {
    // 实时更新 UI
    updateMessage({ content: fullContent, contentBlocks })
  },
  () => {
    // 流结束
    onFinish()
  },
  (error) => {
    // 错误处理
    onError(error)
  }
)
```

---

### 3. 消息类型

OpenClaw 支持多种消息块类型，每种类型有不同的渲染样式：

| 类型 | 用途 | 渲染样式 |
|------|------|----------|
| `text` | 普通文本 | Markdown 渲染 (TipTap) |
| `thinking` | AI 思考过程 | 紫色边框框 + 🧠 Brain 图标 |
| `toolCall` | 工具调用 | 蓝色边框框 + 🔧 Terminal 图标 |
| `toolResult` | 工具执行结果 | 绿色边框框 + → ChevronRight 图标 |
| `image` | 图片 | 直接显示 (支持 Base64) |

#### 思考块 (Thinking)

```
┌─────────────────────────────────────┐
│ 🧠 Thinking [signature]             │
├─────────────────────────────────────┤
│ AI 的思考内容...                    │
│ 我需要分析这个问题，然后...          │
└─────────────────────────────────────┘
```

#### 工具调用块 (Tool Call)

```
┌─────────────────────────────────────┐
│ 🔧 Tool Call: read    path:...     │
├─────────────────────────────────────┤
│ Command: ls -la /home/goldie/...    │
└─────────────────────────────────────┘
```

#### 工具结果块 (Tool Result)

```
┌─────────────────────────────────────┐
│ → Tool Result: exec          Exit:0│
├─────────────────────────────────────┤
│ file1.txt                           │
│ file2.json                          │
├─────────────────────────────────────┤
│ Duration: 123ms  ⏰ 2月17日 14:30  │
└─────────────────────────────────────┘
```

---

### 4. 实时更新机制

#### 双层同步策略

为了保证数据完整性和实时性，采用 SSE + 轮询的双重机制：

```
用户发送消息
  ↓
创建临时 pending 消息 (占位符)
  ↓
┌─────────────────────┐
│  SSE 流式响应       │  ← 实时更新 UI
│  (快速但可能不完整) │
└─────────────────────┘
  ↓
同时启动轮询 (每 1 秒)
  ↓
┌─────────────────────┐
│  轮询历史 API       │  ← 获取完整数据
│  (慢但准确)         │
└─────────────────────┘
  ↓
合并数据，替换 pending 消息
```

#### 轮询实现

```typescript
// 发送消息时启动轮询
pollingRef.current = setInterval(async () => {
  if (!isLoadingRef.current) return

  // 获取自用户消息以来的所有 assistant 消息
  const assistantMsgs = await openclawApi.getAssistantMessages(
    sessionKey,
    userTimestamp  // 从用户消息时间戳开始
  )

  if (assistantMsgs.length > 0) {
    // 更新消息列表
    setMessages(prev => {
      const userIdx = prev.findIndex(m => m.timestamp === userTimestamp)
      const beforePending = prev.slice(0, userIdx + 1).filter(m => !m.id.startsWith('pending-'))
      return [...beforePending, ...assistantMsgs]
    })
  }
}, 1000)
```

---

## UI/UX 特性

### 1. 响应式设计

#### 桌面端

- 固定布局，高度 `100vh`
- 独立的滚动区域
- 无键盘处理需求

#### 移动端

```typescript
// 使用 Visual Viewport API 检测键盘状态
useEffect(() => {
  const handleResize = () => {
    const height = window.visualViewport.height
    const width = window.visualViewport.width

    // 记录最大高度（通常是键盘关闭状态）
    if (height > maxHeightRef.current) {
      maxHeightRef.current = height
    }

    // 检测键盘是否打开（高度显著减少）
    const isKeyboardOpen = maxHeightRef.current - height > 150
    setIsKeyboardOpen(isKeyboardOpen)

    // 动态设置容器高度
    setViewportHeight(height)
  }

  window.visualViewport?.addEventListener('resize', handleResize)
}, [])
```

**键盘打开时:**
- 高度动态调整到可视区域
- z-index 提升 (`z-[45]`) 避免被导航栏遮挡
- 输入框自动聚焦

**键盘关闭时:**
- 高度恢复到 `100vh`
- z-index 恢复 (`z-[35]`)

---

### 2. 富文本渲染 (TipTap)

使用 TipTap 编辑器的只读模式渲染 Markdown：

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,  // 使用 CodeBlockLowlight 替代
    }),
    CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
    Markdown.configure({ markedOptions: { gfm: true } }),
    Image.configure({ inline: false, allowBase64: true }),
    Table.configure({ resizable: true }),
  ],
  content: textContent,
  contentType: 'markdown',
  editable: false,  // 只读模式
})
```

**支持的格式:**
- 标题 (H1-H6)
- 代码块 (带语法高亮)
- 内联代码
- 表格 (可调整列宽)
- 图片 (支持 Base64)
- 引用块
- 列表 (有序/无序)
- 链接
- 粗体/斜体/删除线
- 水平分割线

**代码高亮主题:**
- 语法高亮使用 `lowlight` (集成 `highlight.js`)
- 支持多种语言
- 自动添加"复制"按钮

```typescript
// 自动为代码块添加复制按钮
const addCopyButtons = () => {
  const codeBlocks = editor.view.dom.querySelectorAll('pre')
  codeBlocks.forEach((pre) => {
    if (pre.querySelector('.code-copy-btn')) return

    const button = document.createElement('button')
    button.className = 'code-copy-btn'
    button.innerHTML = '<svg>...</svg>' // 复制图标

    button.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent
      await navigator.clipboard.writeText(code)
      button.classList.add('copied')
    })

    pre.appendChild(button)
  })
}
```

---

### 3. 消息持久化

```typescript
const STORAGE_KEY = 'openclaw-chat-messages'

// 加载历史
function loadFromStorage(): ChatMessage[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

// 保存消息
function saveToStorage(messages: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
}

// 组件加载时
useEffect(() => {
  // 优先从 localStorage 加载
  const cached = loadFromStorage()
  if (cached.length > 0) {
    setMessages(cached)
  }

  // 同时从服务器拉取最新历史
  const history = await openclawApi.getHistory('main')
  setMessages(history)

  // 持久化到 localStorage
}, [])
```

**优势:**
- 刷新页面后保留聊天记录
- 离线时显示缓存消息
- 服务器同步后自动更新

---

### 4. 时间戳格式化

```typescript
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()

  // 计算天数差
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24))

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  if (diffDays === 0) {
    return `${hours}:${minutes}`  // 今天
  } else if (diffDays === 1) {
    return `昨天 ${hours}:${minutes}`
  } else {
    return `${month}月${day}日 ${hours}:${minutes}`
  }
}
```

---

## 消息流程详解

### 发送消息流程

```
用户输入消息并提交
  ↓
ChatWindow.handleSubmit()
  ↓
创建用户消息对象
{
  id: timestamp.toString(),
  role: 'user',
  content: input.trim(),
  timestamp: Date.now()
}
  ↓
创建临时 pending 消息 (assistant 占位符)
{
  id: `pending-${timestamp}`,
  role: 'assistant',
  content: '',
  timestamp: timestamp + 1
}
  ↓
更新消息列表
setMessages([...prev, userMessage, pendingAssistantMessage])
  ↓
调用 openclawApi.sendMessageStream()
  ↓
POST /api/openclaw/chat/stream
  ↓
┌─────────────────────────────────────┐
│ API 路由层处理                       │
├─────────────────────────────────────┤
│ 1. 连接/检查 OpenClaw Gateway       │
│ 2. 发送 chat.send 请求              │
│ 3. 建立 SSE 流                      │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ WebSocket 通信                      │
├─────────────────────────────────────┤
│ Gateway.chatSend(sessionKey, message)│
│ ↓                                  │
│ OpenClaw Gateway 处理 AI 请求       │
│ ↓                                  │
│ SSE 事件流返回:                     │
│   - start                          │
│   - content (thinking/toolCall/text)│
│   - finish                         │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 前端实时更新 UI (SSE)              │
├─────────────────────────────────────┤
│ onChunk(delta, fullContent, blocks) │
│ ↓                                  │
│ 累积 thinking/toolCall 块          │
│ ↓                                  │
│ 更新 pending 消息内容              │
└─────────────────────────────────────┘
  ↓
同时启动轮询 (1秒间隔)
  ↓
┌─────────────────────────────────────┐
│ 轮询历史 API                        │
├─────────────────────────────────────┤
│ getAssistantMessages(sessionKey,    │
│                       userTimestamp)│
│ ↓                                  │
│ 获取完整的 assistant 消息           │
│ (包含 toolResult 等)                │
└─────────────────────────────────────┘
  ↓
替换 pending 消息为完整消息
  ↓
保存到 localStorage
  ↓
滚动到底部
```

### 加载历史流程

```
页面加载 (aichat/page.tsx)
  ↓
ChatWindow 组件初始化
  ↓
useEffect 触发历史加载
  ↓
调用 openclawApi.getHistory('main')
  ↓
GET /api/openclaw/chat/history?sessionKey=main
  ↓
Gateway.chatHistory(sessionKey)
  ↓
WebSocket 请求历史
  ↓
┌─────────────────────────────────────┐
│ 消息过滤与转换                       │
├─────────────────────────────────────┤
│ 1. 过滤系统消息                     │
│    (Conversation info, Reasoning等) │
│ 2. 清理用户消息                     │
│    (移除时间戳前缀)                  │
│ 3. 提取 thinking blocks             │
│ 4. 提取 content blocks             │
└─────────────────────────────────────┘
  ↓
转换前端消息格式
{
  id: `${timestamp}-${idx}`,
  role: 'user' | 'assistant',
  content: string,
  timestamp: number,
  thinkingBlocks: [...],
  contentBlocks: [...]
}
  ↓
渲染消息列表
  ↓
保存到 localStorage
```

---

## 认证与安全

### 环境变量配置

在项目根目录的 `.env.local` 文件中配置：

```env
# OpenClaw Gateway 配置
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_TOKEN=your-token-here
```

### 认证流程详解

```typescript
// 1. 生成/加载设备身份
const deviceIdentity = loadOrCreateDeviceIdentity()
// -> {
//      deviceId: "abc-123-def-456",
//      privateKeyPem: "-----BEGIN PRIVATE KEY-----...",
//      publicKeyPem: "-----BEGIN PUBLIC KEY-----...",
//      createdAt: 1234567890
//    }

// 2. 构建认证 payload
const payload = {
  deviceId: deviceIdentity.deviceId,
  clientId: 'webchat-ui',
  clientMode: 'webchat',
  role: 'operator',
  scopes: ['operator.admin', 'operator.read', 'operator.write'],
  signedAtMs: Date.now(),
  token: storedDeviceToken || sharedToken,
  nonce: connectChallengeNonce
}

// 3. 使用私钥签名
const signature = signDevicePayload(
  deviceIdentity.privateKeyPem,
  JSON.stringify(payload)
)

// 4. 发送 connect 请求
await gateway.request('connect', {
  minProtocol: 3,
  maxProtocol: 3,
  client: {
    id: 'webchat-ui',
    displayName: 'WhiteNote',
    version: '1.0.0',
    platform: 'web',
    mode: 'webchat'
  },
  role: 'operator',
  scopes: ['operator.admin', 'operator.read', 'operator.write'],
  auth: { token: authToken },
  device: {
    id: deviceIdentity.deviceId,
    publicKey: publicKeyRawBase64UrlFromPem(publicKeyPem),
    signature: signature,
    signedAt: signedAtMs,
    nonce: nonce
  }
})

// 5. 接收 hello-ok 响应
// {
//   type: 'hello-ok',
//   protocol: 3,
//   server: { version: '0.x.x', connId: '...' },
//   auth: {
//     deviceToken: 'new-device-token-abc',
//     role: 'operator',
//     scopes: ['operator.admin', ...]
//   }
// }

// 6. 持久化 deviceToken
storeDeviceAuthToken({
  deviceId: deviceIdentity.deviceId,
  role: 'operator',
  token: deviceToken,
  scopes: ['operator.admin', ...]
})
```

### 安全特性

1. **设备绑定**: 每个 deviceToken 绑定到特定设备身份
2. **私钥签名**: 防止中间人攻击
3. **Token 持久化**: 避免重复认证，减少服务器负担
4. **Nonce 防重放**: 每次连接使用随机 nonce
5. **自动回退**: deviceToken 失效时自动回退到共享 token

---

## API 接口文档

### 1. 发送消息 (SSE 流式)

**端点:** `POST /api/openclaw/chat/stream`

**请求体:**
```json
{
  "sessionKey": "main",
  "content": "你好，请分析这个文件"
}
```

**响应 (SSE 流):**
```
data: {"type":"start","sessionKey":"main"}

data: {"type":"content","contentBlocks":[
  {"type":"thinking","thinking":"我需要先读取文件..."},
  {"type":"toolCall","name":"read","arguments":{"path":"/path/to/file"}}
],"incremental":true}

data: {"type":"content","contentBlocks":[
  {"type":"thinking","thinking":"我需要先读取文件..."},
  {"type":"toolCall","name":"read","arguments":{"path":"/path/to/file"}},
  {"type":"text","text":"文件内容如下：\n\n```json\n{...}\n```"}
]}

data: {"type":"finish","runId":"abc123","usage":{"tokens":150},"stopReason":"end_turn"}
```

---

### 2. 获取聊天历史

**端点:** `GET /api/openclaw/chat/history?sessionKey=main&limit=50`

**响应:**
```json
{
  "sessionKey": "main",
  "sessionId": "session-abc-123",
  "messages": [
    {
      "id": "1700000000000-0",
      "role": "user",
      "content": "你好",
      "timestamp": 1700000000000
    },
    {
      "id": "1700000001000-0",
      "role": "assistant",
      "content": "你好！有什么我可以帮你的吗？",
      "timestamp": 1700000001000,
      "thinkingBlocks": [
        {
          "type": "thinking",
          "thinking": "用户打招呼，我需要友好地回复"
        }
      ],
      "contentBlocks": [
        {"type":"text","text":"你好！有什么我可以帮你的吗？"}
      ]
    }
  ]
}
```

---

### 3. 获取助手消息 (轮询专用)

**端点:** `GET /api/openclaw/chat/assistant-messages?sessionKey=main&afterTimestamp=1700000000000`

**响应:** 与历史接口相同，但只返回指定时间戳之后的 assistant 消息。

---

## 使用指南

### 启动 OpenClaw Gateway

```bash
# 启动 OpenClaw Gateway 服务
openclaw gateway start

# 默认监听 ws://localhost:18789
# 如需修改端口或 token，编辑 OpenClaw 配置文件
```

### 配置环境变量

创建 `.env.local` 文件：

```env
# OpenClaw Gateway 配置
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_TOKEN=your-token-here

# 其他配置保持不变
DATABASE_URL="..."
NEXTAUTH_SECRET="..."
```

### 启动 WhiteNote

```bash
cd /media/goldie/ADATA_SP550_111GB1/Code/whitenote

# 1. 安装依赖
pnpm install

# 2. 构建项目 (必须)
pnpm build

# 3. 启动开发服务器
pnpm dev
```

### 访问 AI Chat

打开浏览器访问：
```
http://localhost:3005/aichat
```

---

## 故障排查

### 1. 连接失败

**症状:** 页面显示 "Failed to connect to OpenClaw Gateway"

**解决方案:**
1. 检查 OpenClaw Gateway 是否运行
   ```bash
   openclaw gateway status
   ```
2. 检查 `.env.local` 中的 `OPENCLAW_GATEWAY_URL` 是否正确
3. 检查 `OPENCLAW_TOKEN` 是否有效

---

### 2. 消息不更新

**症状:** 发送消息后 pending 占位符一直存在，没有更新

**解决方案:**
1. 检查浏览器控制台是否有 WebSocket 错误
2. 检查轮询是否正常工作 (查看 "Polling update" 日志)
3. 尝试刷新页面，重新连接

---

### 3. 历史记录丢失

**症状:** 刷新页面后聊天记录为空

**解决方案:**
1. 检查 localStorage 是否被清除 (浏览器隐私设置)
2. 检查是否有 JavaScript 错误阻止保存
3. 查看浏览器控制台是否有 "Failed to save to storage" 错误

---

### 4. 移动端键盘问题

**症状:** 键盘打开时输入框被遮挡

**解决方案:**
1. 检查浏览器是否支持 Visual Viewport API
2. 尝试使用 Chrome/Safari 最新版本
3. 检查 CSS z-index 是否正确

---

## 调试技巧

### 启用 WebSocket 调试日志

编辑 `src/lib/openclaw/gateway.ts`，取消注释调试标志：

```typescript
// ========== DEBUG FLAGS - 取消注释以下行来启用调试日志 ==========
const DEBUG_WS = true;  // 启用 WebSocket 调试日志
// ========== END DEBUG FLAGS ==========
```

### 常用日志查询

```bash
# 查看连接日志
grep "OpenClawGateway" logs

# 查看 SSE 事件
grep "OpenClaw Stream" logs

# 查看轮询更新
grep "OpenClawChat Polling" logs
```

---

## 设计亮点

| 特性 | 实现方式 | 优势 |
|------|----------|------|
| **增量渲染** | thinking/toolCall 块逐步累积 | 真正的流式效果，用户体验好 |
| **数据完整性** | SSE + 轮询双层机制 | 确保最终数据正确 |
| **消息清理** | 自动过滤系统消息和时间戳 | 前端显示干净整洁 |
| **错误恢复** | WebSocket 断线自动重连 | 网络抖动不影响使用 |
| **移动优化** | Visual Viewport API 动态调整 | 键盘打开时不遮挡 |
| **代码复制** | 自动为代码块添加复制按钮 | 开发者友好 |
| **设备认证** | 公私钥签名 + token 持久化 | 安全且高效 |

---

## 性能优化

### 1. 消息渲染优化

- 使用 `key` 属性优化 React 列表渲染
- TipTap 编辑器使用 `immediatelyRender: false` 减少初始渲染时间
- 代码块使用虚拟滚动 (如果消息很多)

### 2. 轮询优化

- 只在消息发送时启动轮询
- 流结束后自动清除轮询定时器
- 使用 `requestRef` 避免闭包问题

### 3. WebSocket 连接优化

- 使用全局单例模式，避免重复连接
- 断线重连使用指数退避策略
- 心跳检测机制及时发现问题

---

## 未来改进方向

- [ ] 支持多会话管理 (目前固定使用 `main` 会话)
- [ ] 支持消息编辑和删除
- [ ] 支持文件上传到 AI Chat
- [ ] 支持流式语音输入
- [ ] 支持自定义主题和样式
- [ ] 添加消息搜索功能
- [ ] 支持导出聊天记录 (Markdown/JSON)
- [ ] 添加 AI 响应质量评价系统

---

## 相关资源

- [Next.js 文档](https://nextjs.org/docs)
- [TipTap 编辑器文档](https://tiptap.dev/)
- [OpenClaw 文档](https://docs.openclaw.ai)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

## 更新日志

- **2026-02-17**: 初始文档，完整描述 AI Chat 功能
