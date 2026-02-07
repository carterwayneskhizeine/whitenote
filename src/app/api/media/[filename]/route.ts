import { NextRequest, NextResponse } from "next/server"
import { stat } from "fs/promises"
import { createReadStream, existsSync } from "fs"
import { join } from "path"
import { Readable } from "stream"

// Upload directory outside the codebase
// 获取上传目录，支持 Docker 和本地开发环境
function getUploadDir(): string {
  const envDir = process.env.UPLOAD_DIR
  if (envDir) {
    return envDir
  }
  // 默认使用相对于项目根目录的路径
  return join(process.cwd(), "data", "uploads")
}

const UPLOAD_DIR = getUploadDir()

/**
 * GET /api/media/[filename]
 * Serve uploaded media files with Range support for streaming
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const filePath = join(UPLOAD_DIR, filename)

  // Check if file exists
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  try {
    const fileStat = await stat(filePath)
    const fileSize = fileStat.size
    
    // Determine content type based on extension
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase()
    const contentType = getContentType(ext)

    // Handle Range header for video streaming
    const range = request.headers.get("range")

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = (end - start) + 1

      const fileStream = createReadStream(filePath, { start, end })
      
      // Convert Node stream to Web ReadableStream for Next.js Response
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => {
            try {
              controller.enqueue(chunk)
            } catch (error) {
              // Controller is closed, destroy stream
              fileStream.destroy()
            }
          })
          fileStream.on("end", () => {
            try { controller.close() } catch (e) {}
          })
          fileStream.on("error", (err: any) => {
            if (err.code === "ENOENT") {
              try { controller.error(err) } catch (e) {}
            } else {
              // Ignore other errors (like premature close) and just close stream
              try { controller.close() } catch (e) {}
            }
          })
        },
        cancel() {
          fileStream.destroy()
        },
      })

      return new NextResponse(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    }

    // Default: Serve entire file
    const fileStream = createReadStream(filePath)
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => {
          try {
            controller.enqueue(chunk)
          } catch (error) {
            fileStream.destroy()
          }
        })
        fileStream.on("end", () => {
          try { controller.close() } catch (e) {}
        })
        fileStream.on("error", (err: any) => {
          if (err.code === "ENOENT") {
            try { controller.error(err) } catch (e) {}
          } else {
            try { controller.close() } catch (e) {}
          }
        })
      },
      cancel() {
        fileStream.destroy()
      },
    })

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })

  } catch (error) {
    console.error("Failed to serve file:", error)
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 })
  }
}

function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jff": "image/jpeg",
    ".jpj": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    // Videos
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/mp4",
  }

  return contentTypes[ext] || "application/octet-stream"
}