import { Server as SocketIOServer } from "socket.io"
import { Server as HTTPServer } from "http"
import { parse } from "cookie"
import { verifySessionToken } from "./auth"
import chokidar from "chokidar"
import { importFromLocal, parseFilePath } from "@/lib/sync-utils"
import redis from "@/lib/redis"
import * as path from "path"

interface SocketData {
  userId: string
  userName: string
}

// 使用全局变量确保在开发模式下也能访问到同一个实例
declare global {
  var _io: SocketIOServer | undefined
}

let io: SocketIOServer | null = (typeof global !== 'undefined' ? global._io : null) || null

export function initSocketServer(httpServer: HTTPServer) {
  if (io) {
    return io
  }

  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL
        : ["http://localhost:3005", "http://localhost:3000"],
      credentials: true,
    },
    // Cloudflare Tunnel 优化配置
    transports: ["websocket", "polling"],
    pingTimeout: 30000,
    pingInterval: 25000,
    // 允许更长的握手超时（适应 Cloudflare Tunnel）
    connectTimeout: 45000,
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie

      if (!cookies) {
        return next(new Error("No cookies provided"))
      }

      // Parse cookies to get session token
      const parsed = parse(cookies)

      // NextAuth v5 使用 authjs.session-token，v4 使用 next-auth.session-token
      let sessionToken = parsed["authjs.session-token"]
      let salt = "authjs.session-token"

      if (!sessionToken && parsed["__Secure-authjs.session-token"]) {
        sessionToken = parsed["__Secure-authjs.session-token"]
        salt = "__Secure-authjs.session-token"
      } else if (!sessionToken && parsed["next-auth.session-token"]) {
        sessionToken = parsed["next-auth.session-token"]
        salt = "next-auth.session-token"
      } else if (!sessionToken && parsed["__Secure-next-auth.session-token"]) {
        sessionToken = parsed["__Secure-next-auth.session-token"]
        salt = "__Secure-next-auth.session-token"
      }

      if (!sessionToken) {
        return next(new Error("No session token found"))
      }

      // Verify the JWT token using the token and the salt
      const userData = await verifySessionToken(sessionToken, salt)

      if (!userData) {
        return next(new Error("Invalid or expired session"))
      }

      // Attach verified user data to socket
      socket.data = {
        userId: userData.userId,
        userName: userData.name || userData.email,
      }

      next()
    } catch (error) {
      console.error("[Socket] Auth error:", error)
      next(new Error("Authentication failed"))
    }
  })

  io.on("connection", (socket) => {
    // Join user-specific room for receiving notifications
    const userRoom = `user:${socket.data.userId}`
    socket.join(userRoom)

    // Join message room for real-time editing
    socket.on("edit:start", ({ messageId }) => {
      socket.join(`message:${messageId}`)
      socket.to(`message:${messageId}`).emit("user:editing", {
        userId: socket.data.userId,
        userName: socket.data.userName,
        messageId,
      })
    })

    // Stop editing
    socket.on("edit:stop", ({ messageId }) => {
      socket.leave(`message:${messageId}`)
      socket.to(`message:${messageId}`).emit("user:stopped-editing", {
        userId: socket.data.userId,
        messageId,
      })
    })

    // Broadcast content changes
    socket.on("sync:content", ({ messageId, content }) => {
      socket.to(`message:${messageId}`).emit("sync:receive", {
        messageId,
        content,
        senderId: socket.data.userId,
      })
    })

    // Disconnect
    socket.on("disconnect", () => {
      // Cleanup if needed
    })
  })

  // 保存到全局变量
  if (typeof global !== 'undefined') {
    global._io = io
  }

  // Initialize File Watcher for MD Sync
  // 获取文件监听目录，支持环境变量配置
  const SYNC_DIR = process.env.FILE_WATCHER_DIR || path.join(process.cwd(), "data", "link_md")
  let watcher: ReturnType<typeof chokidar.watch> | null = null

  // Queue for serializing file imports to prevent database transaction timeout
  const importQueue: Array<{ filePath: string }> = []
  let isProcessingQueue = false

  async function processImportQueue() {
    if (isProcessingQueue || importQueue.length === 0) {
      return
    }

    isProcessingQueue = true

    while (importQueue.length > 0) {
      const item = importQueue.shift()
      if (item) {
        try {
          // Parse the file path to extract workspaceId
          const parsed = parseFilePath(item.filePath)
          if (parsed) {
            console.log(`[FileWatcher] Processing ${item.filePath}`)
            await importFromLocal(parsed.workspaceId, item.filePath)
          }
        } catch (error) {
          console.error(`[FileWatcher] Error importing ${item.filePath}:`, error)
        }
      }
      // Small delay between imports to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    isProcessingQueue = false
  }

  try {
    // Watch the entire directory recursively
    watcher = chokidar.watch(SYNC_DIR, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    })

    watcher.on('change', async (filePath) => {
      // Only process .md files
      if (!filePath.endsWith('.md')) {
        return
      }

      // Check if watcher is paused via Redis (for distributed coordination)
      const isPaused = await redis.get("file-watcher:paused")
      if (isPaused) {
        console.log(`[FileWatcher] Watcher paused, ignoring change: ${filePath}`)
        return
      }

      console.log(`[FileWatcher] File changed: ${filePath}`)

      // Parse the file path to determine if it's a message or comment
      const parsed = parseFilePath(filePath)
      if (!parsed) {
        console.log(`[FileWatcher] Could not parse file path ${filePath}, skipping`)
        return
      }

      // Add to queue instead of processing immediately
      importQueue.push({ filePath })
      console.log(`[FileWatcher] Queued ${filePath} (queue size: ${importQueue.length})`)

      // Start processing the queue
      processImportQueue()
    })

    watcher.on('error', error => console.error(`[FileWatcher] Error: ${error}`))

    watcher.on('ready', () => {
      console.log(`[FileWatcher] Ready. Watching: ${SYNC_DIR}`)
      const watched = watcher?.getWatched()
      if (watched) {
        console.log(`[FileWatcher] Watching paths:`, Object.keys(watched))
      }
    })

    console.log('[FileWatcher] Started watching:', SYNC_DIR)
  } catch (error) {
    console.error('[FileWatcher] Failed to start watcher:', error)
  }

  return io
}

export function getSocketServer() {
  // 优先从全局变量获取
  if (typeof global !== 'undefined' && global._io) {
    return global._io
  }
  return io
}
