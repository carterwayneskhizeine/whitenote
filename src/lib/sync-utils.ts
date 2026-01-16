import * as fs from "fs"
import * as path from "path"
import prisma from "@/lib/prisma"
import { addTask } from "@/lib/queue"

const SYNC_DIR = "D:\\Code\\whitenote-data\\link_md"
const WORKSPACE_DIR = path.join(SYNC_DIR, ".whitenote")
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, "workspace.json")

// Ensure directories exist
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true })
}

if (!fs.existsSync(SYNC_DIR)) {
  fs.mkdirSync(SYNC_DIR, { recursive: true })
}

interface FileMeta {
  type: "message" | "comment"
  id: string
  created_at: string
  updated_at: string
  author: string
  tags: string
}

interface WorkspaceData {
  files: Record<string, FileMeta>
}

// Helper: Read Workspace JSON
export function getWorkspaceData(): WorkspaceData {
  if (!fs.existsSync(WORKSPACE_FILE)) return { files: {} }
  try {
    return JSON.parse(fs.readFileSync(WORKSPACE_FILE, "utf-8"))
  } catch {
    return { files: {} }
  }
}

// Helper: Write Workspace JSON
function saveWorkspaceData(data: WorkspaceData) {
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(data, null, 2))
}

// Helper: Parse MD Content
export function parseMdFile(content: string) {
  const lines = content.split("\n")
  const firstLine = lines[0] || ""
  const body = lines.slice(1).join("\n").trim()

  // Extract tags from first line (e.g., "#tag1 #tag2")
  const tags = firstLine.match(/#[\w\u4e00-\u9fa5]+/g) || []

  return {
    tags: tags.map(t => t.substring(1)), // remove #
    content: body
  }
}

/**
 * EXPORT: DB -> Local File
 */
export async function exportToLocal(type: "message" | "comment", id: string) {
  let data: any
  let authorEmail = ""

  if (type === "message") {
    data = await prisma.message.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        author: true
      }
    })
    authorEmail = data?.author?.email || "unknown"
  } else {
    data = await prisma.comment.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        author: true
      }
    })
    authorEmail = data?.author?.email || "unknown"
  }

  if (!data) return

  // Format Tags
  const tagString = data.tags.map((t: any) => `#${t.tag.name}`).join(" ")
  const fileContent = `${tagString}\n\n${data.content}`

  const fileName = `${type}_${data.id}.md`
  const filePath = path.join(SYNC_DIR, fileName)

  // Write File
  fs.writeFileSync(filePath, fileContent)

  // Update Workspace JSON
  const ws = getWorkspaceData()
  ws.files[fileName] = {
    type,
    id: data.id,
    created_at: data.createdAt.toISOString(),
    updated_at: new Date().toISOString(), // Use current time of sync
    author: authorEmail,
    tags: tagString
  }
  saveWorkspaceData(ws)

  console.log(`[SyncUtils] Exported ${type} ${id} to ${fileName}`)
}

/**
 * IMPORT: Local File -> DB
 */
export async function importFromLocal(fileName: string) {
  const ws = getWorkspaceData()
  const meta = ws.files[fileName]
  if (!meta) return // Unknown file, ignore safety check

  const filePath = path.join(SYNC_DIR, fileName)
  if (!fs.existsSync(filePath)) return

  const stats = fs.statSync(filePath)
  const lastModified = stats.mtime.toISOString()

  // Check if file was actually modified (compare with workspace metadata)
  if (meta.updated_at === lastModified) {
    console.log(`[SyncUtils] File ${fileName} not modified, skipping`)
    return
  }

  const contentRaw = fs.readFileSync(filePath, "utf-8")
  const { tags, content } = parseMdFile(contentRaw)

  // 1. Update DB Content
  const record = await prisma.$transaction(async (tx) => {
    let data: any
    if (meta.type === "message") {
      data = await tx.message.findUnique({
        where: { id: meta.id },
        include: { author: true }
      })
      if (data) {
        await tx.message.update({
          where: { id: meta.id },
          data: { content }
        })
      }
    } else {
      data = await tx.comment.findUnique({
        where: { id: meta.id },
        include: { author: true }
      })
      if (data) {
        await tx.comment.update({
          where: { id: meta.id },
          data: { content }
        })
      }
    }
    return data
  })

  if (!record) {
    console.log(`[SyncUtils] Record ${meta.type} ${meta.id} not found, skipping`)
    return
  }

  // 2. Update Workspace JSON with new modified time
  meta.updated_at = lastModified
  saveWorkspaceData(ws)

  // 3. Trigger RAGFlow Sync
  // Find workspace associated with this content
  let workspaceId: string | null = null
  if (meta.type === "message") {
    const msg = await prisma.message.findUnique({
      where: { id: meta.id },
      select: { workspaceId: true }
    })
    workspaceId = msg?.workspaceId || null
  }

  if (workspaceId) {
    await addTask("sync-ragflow", {
      userId: record.author?.id || "",
      workspaceId: workspaceId,
      messageId: meta.id,
      contentType: meta.type
    })
  }

  console.log(`[SyncUtils] Imported ${fileName} to DB and triggered RAGFlow sync`)
}

/**
 * Export all messages and comments to local files
 */
export async function exportAllToLocal(userId: string) {
  const messages = await prisma.message.findMany({
    where: { authorId: userId },
    include: {
      tags: { include: { tag: true } },
      author: true
    }
  })

  const comments = await prisma.comment.findMany({
    where: { authorId: userId },
    include: {
      tags: { include: { tag: true } },
      author: true
    }
  })

  for (const message of messages) {
    await exportToLocal("message", message.id)
  }

  for (const comment of comments) {
    await exportToLocal("comment", comment.id)
  }

  return {
    messagesExported: messages.length,
    commentsExported: comments.length
  }
}

/**
 * Import all modified files from local to DB
 */
export async function importAllFromLocal() {
  const ws = getWorkspaceData()
  const results = {
    imported: 0,
    skipped: 0,
    errors: 0
  }

  for (const [fileName, meta] of Object.entries(ws.files)) {
    try {
      const filePath = path.join(SYNC_DIR, fileName)
      if (!fs.existsSync(filePath)) {
        results.skipped++
        continue
      }

      const stats = fs.statSync(filePath)
      const lastModified = stats.mtime.toISOString()

      // Only import if modified
      if (meta.updated_at !== lastModified) {
        await importFromLocal(fileName)
        results.imported++
      } else {
        results.skipped++
      }
    } catch (error) {
      console.error(`[SyncUtils] Error importing ${fileName}:`, error)
      results.errors++
    }
  }

  return results
}
