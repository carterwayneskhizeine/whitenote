import { Server as SocketIOServer } from "socket.io"
import { Server as HTTPServer } from "http"
import { parse } from "cookie"
import { verifySessionToken } from "./auth"

interface SocketData {
  userId: string
  userName: string
}

let io: SocketIOServer | null = null

export function initSocketServer(httpServer: HTTPServer) {
  if (io) {
    console.log("[Socket] Server already initialized")
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
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie

      if (!cookies) {
        console.error("[Socket] No cookies provided")
        return next(new Error("No cookies provided"))
      }

      // Parse cookies to get session token
      const parsed = parse(cookies)
      const sessionToken = parsed["next-auth.session-token"] || parsed["__Secure-next-auth.session-token"]

      if (!sessionToken) {
        console.error("[Socket] No session token found")
        return next(new Error("No session token found"))
      }

      // Verify the JWT token and get user data
      const userData = await verifySessionToken(sessionToken)

      if (!userData) {
        console.error("[Socket] Invalid or expired session token")
        return next(new Error("Invalid or expired session"))
      }

      // Attach verified user data to socket
      socket.data = {
        userId: userData.userId,
        userName: userData.name || userData.email,
      }

      console.log(`[Socket] User authenticated: ${userData.name || userData.email} (${userData.userId})`)
      next()
    } catch (error) {
      console.error("[Socket] Auth error:", error)
      next(new Error("Authentication failed"))
    }
  })

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`)

    // Join message room for real-time editing
    socket.on("edit:start", ({ messageId }) => {
      socket.join(`message:${messageId}`)
      socket.to(`message:${messageId}`).emit("user:editing", {
        userId: socket.data.userId,
        userName: socket.data.userName,
        messageId,
      })
      console.log(`[Socket] User ${socket.data.userId} started editing ${messageId}`)
    })

    // Stop editing
    socket.on("edit:stop", ({ messageId }) => {
      socket.leave(`message:${messageId}`)
      socket.to(`message:${messageId}`).emit("user:stopped-editing", {
        userId: socket.data.userId,
        messageId,
      })
      console.log(`[Socket] User ${socket.data.userId} stopped editing ${messageId}`)
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
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })

  console.log("[Socket] Server initialized")
  return io
}

export function getSocketServer() {
  return io
}
