import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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
 * POST /api/upload/avatar
 * Upload user avatar image
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File size exceeds 5MB limit` },
        { status: 400 }
      )
    }

    // Get file extension
    const fileName = file.name
    const fileExtension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase()

    // Validate file extension
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
    if (!allowedExtensions.includes(fileExtension)) {
      return Response.json(
        { error: `Invalid file type. Allowed: ${allowedExtensions.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return Response.json(
        { error: "Invalid file type. Only images are allowed." },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Generate unique filename with avatar prefix
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const uniqueFileName = `avatar-${timestamp}-${randomString}${fileExtension}`
    const filePath = join(UPLOAD_DIR, uniqueFileName)

    // Convert file to buffer and write to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Return the URL using API route
    const url = `/api/media/${uniqueFileName}`

    return Response.json({
      data: {
        url,
        fileName: uniqueFileName,
        originalName: fileName,
        size: file.size,
        mimeType: file.type,
      },
    })
  } catch (error) {
    console.error("Avatar upload error:", error)
    return Response.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    )
  }
}
