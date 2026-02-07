import "dotenv/config"  // 必须在所有其他导入之前
import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { initSocketServer } from "./src/lib/socket/server"
import * as fs from "fs"
import * as path from "path"
import { promisify } from "util"

const writeFile = promisify(fs.writeFile)

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = parseInt(process.env.PORT || "3005", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// 获取上传目录，支持 Docker 和本地开发环境
function getUploadDir(): string {
  const envDir = process.env.UPLOAD_DIR
  if (envDir) {
    return envDir
  }
  // 默认使用相对于项目根目录的路径
  return path.join(process.cwd(), "data", "uploads")
}

const UPLOAD_DIR = getUploadDir()

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      const pathname = parsedUrl.pathname || ""

      // Handle upload endpoint with custom multipart parsing
      if (pathname === "/api/upload" && req.method === "POST") {
        await handleUpload(req, res)
        return
      }

      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end("Internal server error")
      }
    }
  })

  // Initialize Socket.io
  initSocketServer(httpServer)

  httpServer
    .once("error", (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})

async function handleUpload(req: any, res: any) {
  // Parse the boundary from content type
  const contentType = req.headers["content-type"] || ""
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i)

  if (!boundaryMatch) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Invalid content type" }))
    return
  }

  const boundary = boundaryMatch[1]
  const chunks: Buffer[] = []
  let currentSize = 0
  const MAX_SIZE = 100 * 1024 * 1024 // 100MB

  // Collect data with size limit
  req.on("data", (chunk: Buffer) => {
    currentSize += chunk.length
    if (currentSize > MAX_SIZE) {
      req.pause()
      res.writeHead(413, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "File too large" }))
      return
    }
    chunks.push(chunk)
  })

  req.on("end", async () => {
    try {
      const buffer = Buffer.concat(chunks)

      // Parse multipart data
      const parts = buffer.toString("binary").split(`--${boundary}`)

      let fileData: Buffer | null = null
      let fileName = ""
      let mimeType = ""

      for (const part of parts) {
        if (part.includes("Content-Disposition")) {
          const headersEnd = part.indexOf("\r\n\r\n")
          if (headersEnd === -1) continue

          const headers = part.substring(0, headersEnd)
          const content = part.substring(headersEnd + 4)

          const filenameMatch = headers.match(/filename="([^"]+)"/)
          const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/)

          if (filenameMatch) {
            fileName = filenameMatch[1]
            mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream"

            // Remove trailing \r\n
            const contentWithoutBoundary = content.replace(/\r\n--$/, "")
            fileData = Buffer.from(contentWithoutBoundary, "binary")
            break
          }
        }
      }

      if (!fileData || !fileName) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "No file found" }))
        return
      }

      // Validate file size
      if (fileData.length > MAX_SIZE) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: `File size exceeds ${MAX_SIZE / 1024 / 1024}MB limit` }))
        return
      }

      // Get file extension
      const fileExtension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase()

      // Allowed extensions
      const ALLOWED_EXTENSIONS = [
        ".jpg", ".jpeg", ".jff", ".jpj", ".png", ".webp", ".gif",
        ".mp4", ".mov", ".m4v"
      ]

      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` }))
        return
      }

      // Determine media type
      const isVideo = mimeType.startsWith("video")
      const mediaType = isVideo ? "video" : "image"

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const uniqueFileName = `${timestamp}-${randomString}${fileExtension}`
      const filePath = path.join(UPLOAD_DIR, uniqueFileName)

      // Write file to disk
      await writeFile(filePath, fileData)

      // Return response
      const url = `/api/media/${uniqueFileName}`

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        data: {
          url,
          type: mediaType,
          fileName: uniqueFileName,
          originalName: fileName,
          size: fileData.length,
          mimeType,
        },
      }))
    } catch (error) {
      console.error("File upload error:", error)
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Failed to upload file" }))
    }
  })

  req.on("error", (err: any) => {
    console.error("Request error:", err)
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Internal server error" }))
    }
  })
}
