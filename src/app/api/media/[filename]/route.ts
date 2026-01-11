import { NextRequest } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// Upload directory outside the codebase
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "..", "whitenote-data", "uploads")

/**
 * GET /api/media/[filename]
 * Serve uploaded media files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const filePath = join(UPLOAD_DIR, filename)

  // Check if file exists
  if (!existsSync(filePath)) {
    return Response.json({ error: "File not found" }, { status: 404 })
  }

  try {
    const file = await readFile(filePath)

    // Determine content type based on extension
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase()
    const contentType = getContentType(ext)

    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Failed to serve file:", error)
    return Response.json({ error: "Failed to serve file" }, { status: 500 })
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
