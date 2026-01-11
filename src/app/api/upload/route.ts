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

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/mov",
  "video/m4v",
  "video/quicktime",
]

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".jff", ".jpj", ".png", ".webp", ".gif",
  ".mp4", ".mov", ".m4v"
]

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// Upload directory outside the codebase
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "..", "whitenote-data", "uploads")

/**
 * POST /api/upload
 * Upload media files (images and videos)
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
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Get file extension
    const fileName = file.name
    const fileExtension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase()

    // Validate file extension
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return Response.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate MIME type
    const mimeType = file.type
    const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType)

    if (!isImage && !isVideo) {
      return Response.json(
        { error: "Invalid file type. Only images and videos are allowed." },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist (outside codebase)
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const uniqueFileName = `${timestamp}-${randomString}${fileExtension}`
    const filePath = join(UPLOAD_DIR, uniqueFileName)

    // Convert file to buffer and write to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Determine media type
    const mediaType = isImage ? "image" : "video"

    // Return the URL using API route instead of static path
    const url = `/api/media/${uniqueFileName}`

    return Response.json({
      data: {
        url,
        type: mediaType,
        fileName: uniqueFileName,
        originalName: fileName,
        size: file.size,
        mimeType,
      },
    })
  } catch (error) {
    console.error("File upload error:", error)
    return Response.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
