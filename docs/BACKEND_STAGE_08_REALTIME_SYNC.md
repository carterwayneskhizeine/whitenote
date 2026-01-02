# WhiteNote 2.5 后端开发指南 - Stage 8: 实时多端同步

> **前置文档**: [Stage 7: 后台任务队列](file:///d:/Code/WhiteNote/docs/BACKEND_STAGE_07_WORKERS.md)  
> **下一步**: [API 测试指南](file:///d:/Code/WhiteNote/docs/API_TESTING_GUIDE.md)

---

## 目标

实现类似 Google Docs 的**实时多端同步编辑**功能：
- 用户在手机上编辑，5 秒无操作后同步到电脑端
- 仅同步已打开且进入编辑模式的同一话题
- 基于 WebSocket 实现

---

## 技术方案

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| WebSocket 服务 | **Socket.io** | 可靠的双向通信 |
| 状态管理 | **Redis Pub/Sub** | 跨进程消息广播 |
| 冲突处理 | **最后写入优先 (LWW)** | 简单可靠 |
| 防抖机制 | **5 秒延迟** | 减少同步频率 |

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      用户编辑流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [手机端]                              [电脑端]              │
│     │                                      │                │
│     │  1. 用户输入                         │                │
│     │     ↓                               │                │
│     │  2. 本地更新 + 防抖计时              │                │
│     │     ↓                               │                │
│     │  3. 5秒后发送 WebSocket              │                │
│     │     ↓                               │                │
│     └────────────→ [服务器] ──────────────→│                │
│                       │                    │                │
│                       ↓                    ↓                │
│                  保存到数据库          4. 接收更新           │
│                                            ↓                │
│                                       5. 更新 UI            │
│                                       (仅编辑模式)           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: 安装依赖

```bash
pnpm add socket.io socket.io-client
pnpm add -D @types/socket.io @types/socket.io-client
```

---

## Step 2: 创建 WebSocket 服务器

创建 `src/lib/socket/server.ts`：

```typescript
import { Server as SocketIOServer, Socket } from "socket.io"
import { Server as HTTPServer } from "http"
import { parse } from "cookie"
import { prisma } from "@/lib/prisma"
import redis from "@/lib/redis"

interface SocketData {
  userId: string
  messageId: string | null
  isEditing: boolean
}

interface SyncPayload {
  messageId: string
  content: string
  timestamp: number
  clientId: string
}

let io: SocketIOServer | null = null

/**
 * 初始化 WebSocket 服务器
 */
export function initSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3005",
      credentials: true,
    },
  })

  // 认证中间件
  io.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie
      if (!cookies) {
        return next(new Error("No session cookie"))
      }

      const parsed = parse(cookies)
      const sessionToken = parsed["next-auth.session-token"]
      
      if (!sessionToken) {
        return next(new Error("No session token"))
      }

      // 验证 session (简化版，实际应解析 JWT)
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })

      if (!session || session.expires < new Date()) {
        return next(new Error("Invalid session"))
      }

      // 存储用户信息
      socket.data = {
        userId: session.userId,
        messageId: null,
        isEditing: false,
      } as SocketData

      next()
    } catch (error) {
      next(new Error("Authentication failed"))
    }
  })

  // 连接处理
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId
    console.log(`[Socket] User connected: ${userId}`)

    // 加入用户专属房间
    socket.join(`user:${userId}`)

    // 订阅 Redis 消息
    subscribeToUserUpdates(socket, userId)

    // 进入编辑模式
    socket.on("edit:start", async (data: { messageId: string }) => {
      const { messageId } = data
      
      // 验证消息所有权
      const message = await prisma.message.findUnique({
        where: { id: messageId, authorId: userId },
      })

      if (!message) {
        socket.emit("error", { message: "Message not found or unauthorized" })
        return
      }

      // 更新 socket 状态
      socket.data.messageId = messageId
      socket.data.isEditing = true

      // 加入消息房间
      socket.join(`message:${messageId}`)

      console.log(`[Socket] User ${userId} started editing message ${messageId}`)
    })

    // 退出编辑模式
    socket.on("edit:stop", () => {
      if (socket.data.messageId) {
        socket.leave(`message:${socket.data.messageId}`)
      }
      socket.data.messageId = null
      socket.data.isEditing = false
    })

    // 接收内容同步
    socket.on("sync:content", async (payload: SyncPayload) => {
      const { messageId, content, timestamp, clientId } = payload
      const userId = socket.data.userId

      // 验证权限
      if (socket.data.messageId !== messageId) {
        socket.emit("error", { message: "Not in edit mode for this message" })
        return
      }

      try {
        // 保存到数据库
        await prisma.message.update({
          where: { id: messageId, authorId: userId },
          data: { content },
        })

        // 通过 Redis 广播给该用户的其他设备
        await redis.publish(
          `sync:${userId}`,
          JSON.stringify({
            type: "content_update",
            messageId,
            content,
            timestamp,
            sourceClientId: clientId,
          })
        )

        console.log(`[Socket] Content synced for message ${messageId}`)
      } catch (error) {
        console.error("[Socket] Sync error:", error)
        socket.emit("sync:error", { messageId, error: "Failed to save" })
      }
    })

    // 断开连接
    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${userId}`)
    })
  })

  return io
}

/**
 * 订阅 Redis 消息 (接收其他设备的更新)
 */
function subscribeToUserUpdates(socket: Socket, userId: string) {
  const subscriber = redis.duplicate()
  
  subscriber.subscribe(`sync:${userId}`, (err) => {
    if (err) {
      console.error("[Redis] Subscribe error:", err)
      return
    }
  })

  subscriber.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message)
      
      // 不发送给自己 (源客户端)
      if (data.sourceClientId === socket.id) {
        return
      }

      // 只发送给正在编辑同一消息的客户端
      if (socket.data.isEditing && socket.data.messageId === data.messageId) {
        socket.emit("sync:receive", {
          messageId: data.messageId,
          content: data.content,
          timestamp: data.timestamp,
        })
      }
    } catch (error) {
      console.error("[Redis] Message parse error:", error)
    }
  })

  // 断开时取消订阅
  socket.on("disconnect", () => {
    subscriber.unsubscribe(`sync:${userId}`)
    subscriber.quit()
  })
}

/**
 * 获取 Socket.IO 实例
 */
export function getIO(): SocketIOServer | null {
  return io
}
```

---

## Step 3: 创建 Socket API Route

创建 `src/app/api/socket/route.ts`：

```typescript
import { NextRequest } from "next/server"

// Socket.IO 通过自定义服务器处理，这里只是占位
export async function GET(request: NextRequest) {
  return Response.json({ 
    message: "Socket.IO is handled by custom server",
    endpoint: "/api/socket"
  })
}
```

---

## Step 4: 自定义服务器集成

创建 `server.ts`：

```typescript
import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { initSocketServer } from "./src/lib/socket/server"

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = parseInt(process.env.PORT || "3005", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  // 初始化 WebSocket
  initSocketServer(httpServer)

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> WebSocket ready on /api/socket`)
  })
})
```

更新 `package.json`：

```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts"
  }
}
```

---

## Step 5: 前端 Socket Hook

创建 `src/hooks/useRealtimeSync.ts`：

```typescript
"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { io, Socket } from "socket.io-client"

interface UseRealtimeSyncOptions {
  messageId: string
  initialContent: string
  onRemoteUpdate?: (content: string) => void
  debounceMs?: number
}

interface UseRealtimeSyncReturn {
  content: string
  setContent: (content: string) => void
  isEditing: boolean
  startEditing: () => void
  stopEditing: () => void
  isSyncing: boolean
  lastSyncTime: Date | null
}

export function useRealtimeSync({
  messageId,
  initialContent,
  onRemoteUpdate,
  debounceMs = 5000,
}: UseRealtimeSyncOptions): UseRealtimeSyncReturn {
  const [content, setContentState] = useState(initialContent)
  const [isEditing, setIsEditing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  
  const socketRef = useRef<Socket | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const clientIdRef = useRef<string>("")

  // 初始化 Socket 连接
  useEffect(() => {
    const socket = io({
      path: "/api/socket",
      withCredentials: true,
    })

    socket.on("connect", () => {
      clientIdRef.current = socket.id || ""
      console.log("[Sync] Connected:", socket.id)
    })

    socket.on("sync:receive", (data: { messageId: string; content: string }) => {
      if (data.messageId === messageId && isEditing) {
        setContentState(data.content)
        onRemoteUpdate?.(data.content)
        console.log("[Sync] Received remote update")
      }
    })

    socket.on("sync:error", (error) => {
      console.error("[Sync] Error:", error)
      setIsSyncing(false)
    })

    socket.on("disconnect", () => {
      console.log("[Sync] Disconnected")
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [messageId, isEditing, onRemoteUpdate])

  // 开始编辑
  const startEditing = useCallback(() => {
    setIsEditing(true)
    socketRef.current?.emit("edit:start", { messageId })
  }, [messageId])

  // 停止编辑
  const stopEditing = useCallback(() => {
    setIsEditing(false)
    socketRef.current?.emit("edit:stop")
    
    // 停止时立即同步
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      syncContent(content)
    }
  }, [content])

  // 同步内容到服务器
  const syncContent = useCallback((newContent: string) => {
    if (!socketRef.current?.connected) return

    setIsSyncing(true)
    socketRef.current.emit("sync:content", {
      messageId,
      content: newContent,
      timestamp: Date.now(),
      clientId: clientIdRef.current,
    })

    setLastSyncTime(new Date())
    setIsSyncing(false)
  }, [messageId])

  // 设置内容 (带防抖)
  const setContent = useCallback((newContent: string) => {
    setContentState(newContent)

    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 设置新的定时器
    if (isEditing) {
      debounceTimerRef.current = setTimeout(() => {
        syncContent(newContent)
      }, debounceMs)
    }
  }, [isEditing, debounceMs, syncContent])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    content,
    setContent,
    isEditing,
    startEditing,
    stopEditing,
    isSyncing,
    lastSyncTime,
  }
}
```

---

## Step 6: 编辑器组件集成

创建 `src/components/editor/SyncEditor.tsx`：

```tsx
"use client"

import { useRealtimeSync } from "@/hooks/useRealtimeSync"
import { useCallback, useEffect, useState } from "react"

interface SyncEditorProps {
  messageId: string
  initialContent: string
  onSave?: (content: string) => void
}

export function SyncEditor({ messageId, initialContent, onSave }: SyncEditorProps) {
  const {
    content,
    setContent,
    isEditing,
    startEditing,
    stopEditing,
    isSyncing,
    lastSyncTime,
  } = useRealtimeSync({
    messageId,
    initialContent,
    debounceMs: 5000, // 5 秒后同步
    onRemoteUpdate: (newContent) => {
      // 收到远程更新的回调
      console.log("Remote update received")
    },
  })

  const handleFocus = useCallback(() => {
    startEditing()
  }, [startEditing])

  const handleBlur = useCallback(() => {
    stopEditing()
    onSave?.(content)
  }, [stopEditing, content, onSave])

  return (
    <div className="relative">
      {/* 同步状态指示 */}
      <div className="absolute top-2 right-2 flex items-center gap-2 text-xs text-gray-500">
        {isSyncing && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            同步中...
          </span>
        )}
        {lastSyncTime && !isSyncing && (
          <span className="text-green-600">
            ✓ 已同步
          </span>
        )}
        {isEditing && (
          <span className="text-blue-500">编辑中</span>
        )}
      </div>

      {/* 编辑区域 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full min-h-[200px] p-4 border rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="开始编辑..."
      />

      {/* 编辑模式提示 */}
      {isEditing && (
        <p className="text-xs text-gray-400 mt-2">
          停止输入 5 秒后自动同步到其他设备
        </p>
      )}
    </div>
  )
}
```

---

## 同步规则总结

| 场景 | 行为 |
|------|------|
| 用户开始编辑 | 发送 `edit:start`，加入消息房间 |
| 用户输入内容 | 本地更新，启动 5 秒防抖计时器 |
| 5 秒无输入 | 发送 `sync:content` 到服务器 |
| 服务器收到同步 | 保存数据库 + Redis 广播 |
| 其他设备收到广播 | 仅编辑模式下更新 UI |
| 用户退出编辑 | 发送 `edit:stop`，离开房间 |
| 新建话题 | 其他设备需刷新才能看到 |

---

## 验证检查点

```bash
# 1. 启动服务 (自定义服务器)
pnpm dev

# 2. 打开两个浏览器窗口，用同一账号登录
# 3. 在两个窗口打开同一条消息
# 4. 在一个窗口进入编辑模式
# 5. 在另一个窗口也进入编辑模式
# 6. 在第一个窗口输入内容
# 7. 等待 5 秒后，第二个窗口应收到更新
```

---

## 注意事项

1. **仅同步编辑模式**：如果用户没有进入编辑模式，不会收到同步
2. **同一消息限制**：只有打开同一条消息的设备才会同步
3. **新消息需刷新**：新创建的消息不会自动出现在其他设备
4. **最后写入优先**：如果两个设备同时编辑，最后保存的内容会覆盖
