import * as fs from "fs"
import * as path from "path"
import prisma from "@/lib/prisma"
import { addTask } from "@/lib/queue"

const SYNC_DIR = "D:\\Code\\whitenote-data\\link_md"

// Helper: Ensure directory exists
function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

interface FileMeta {
  type: "message" | "comment"
  id: string
  created_at: string
  updated_at: string
  author: string
  authorName: string
  tags: string
  messageId: string | null  // For comments: which message they belong to
}

interface WorkspaceInfo {
  id: string
  name: string
  lastSyncedAt: string
}

interface Relations {
  [messageFileKey: string]: {
    type: "message"
    comments: string[]  // Array of comment file keys
  }
}

interface WorkspaceData {
  workspace: WorkspaceInfo
  files: Record<string, FileMeta>
  relations: Relations
}

/**
 * Get workspace directory path for a specific workspace
 */
function getWorkspaceDir(workspaceId: string): string {
  return path.join(SYNC_DIR, workspaceId)
}

/**
 * Get workspace.json file path for a specific workspace
 */
function getWorkspaceFile(workspaceId: string): string {
  return path.join(getWorkspaceDir(workspaceId), ".whitenote", "workspace.json")
}

/**
 * Read Workspace JSON for a specific workspace
 */
export function getWorkspaceData(workspaceId: string): WorkspaceData {
  const workspaceFile = getWorkspaceFile(workspaceId)
  if (!fs.existsSync(workspaceFile)) {
    // Return default structure
    return {
      workspace: {
        id: workspaceId,
        name: "",
        lastSyncedAt: new Date().toISOString()
      },
      files: {},
      relations: {}
    }
  }
  try {
    return JSON.parse(fs.readFileSync(workspaceFile, "utf-8"))
  } catch {
    return {
      workspace: {
        id: workspaceId,
        name: "",
        lastSyncedAt: new Date().toISOString()
      },
      files: {},
      relations: {}
    }
  }
}

/**
 * Write Workspace JSON for a specific workspace
 */
function saveWorkspaceData(workspaceId: string, data: WorkspaceData) {
  const workspaceDir = getWorkspaceDir(workspaceId)
  const metaDir = path.join(workspaceDir, ".whitenote")

  // Ensure directories exist before writing
  ensureDirectoryExists(metaDir)

  const workspaceFile = getWorkspaceFile(workspaceId)
  fs.writeFileSync(workspaceFile, JSON.stringify(data, null, 2))
}

/**
 * Parse MD Content to extract tags and body
 */
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
 * EXPORT: DB -> Local File (organized by workspace)
 */
export async function exportToLocal(type: "message" | "comment", id: string) {
  let data: any
  let workspaceId: string

  if (type === "message") {
    data = await prisma.message.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        author: true,
        workspace: true
      }
    })
    if (!data) return
    workspaceId = data.workspaceId
  } else {
    data = await prisma.comment.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        author: true,
        message: {
          select: {
            workspaceId: true,
            workspace: true
          }
        }
      }
    })
    if (!data) return
    workspaceId = data.message.workspaceId
  }

  // Format Tags
  const tagString = data.tags.map((t: any) => `#${t.tag.name}`).join(" ")
  const fileContent = `${tagString}\n\n${data.content}`

  // Get workspace directory
  const workspaceDir = getWorkspaceDir(workspaceId)
  ensureDirectoryExists(workspaceDir)

  const fileName = `${type}_${data.id}.md`
  const filePath = path.join(workspaceDir, fileName)

  // Write File
  fs.writeFileSync(filePath, fileContent)

  // Update Workspace JSON
  const ws = getWorkspaceData(workspaceId)

  // Update workspace info
  ws.workspace.id = workspaceId
  ws.workspace.name = type === "message"
    ? (data.workspace?.name || "")
    : (data.message?.workspace?.name || "")
  ws.workspace.lastSyncedAt = new Date().toISOString()

  // Add file metadata
  const fileKey = fileName.replace(".md", "")
  ws.files[fileKey] = {
    type,
    id: data.id,
    created_at: data.createdAt.toISOString(),
    updated_at: new Date().toISOString(),
    author: data.author?.email || "unknown",
    authorName: data.author?.name || "Unknown",
    tags: tagString,
    messageId: type === "comment" ? data.messageId : null
  }

  // Update relations for comments
  if (type === "comment") {
    const messageFileKey = `message_${data.messageId}`
    if (!ws.relations[messageFileKey]) {
      ws.relations[messageFileKey] = {
        type: "message",
        comments: []
      }
    }
    if (!ws.relations[messageFileKey].comments.includes(fileKey)) {
      ws.relations[messageFileKey].comments.push(fileKey)
    }
  }

  saveWorkspaceData(workspaceId, ws)

  console.log(`[SyncUtils] Exported ${type} ${id} to ${workspaceId}/${fileName}`)
}

/**
 * IMPORT: Local File -> DB
 */
export async function importFromLocal(workspaceId: string, fileName: string) {
  const ws = getWorkspaceData(workspaceId)
  const meta = ws.files[fileName.replace(".md", "")]
  if (!meta) {
    console.log(`[SyncUtils] Unknown file ${fileName} in workspace ${workspaceId}, skipping`)
    return
  }

  const workspaceDir = getWorkspaceDir(workspaceId)
  const filePath = path.join(workspaceDir, fileName)
  if (!fs.existsSync(filePath)) {
    console.log(`[SyncUtils] File ${filePath} not found, skipping`)
    return
  }

  const stats = fs.statSync(filePath)
  const lastModified = stats.mtime.toISOString()

  // Check if file was actually modified (compare with workspace metadata)
  if (meta.updated_at === lastModified) {
    console.log(`[SyncUtils] File ${fileName} not modified, skipping`)
    return
  }

  const contentRaw = fs.readFileSync(filePath, "utf-8")
  const { tags, content } = parseMdFile(contentRaw)

  // 1. Update DB Content and Tags
  const record = await prisma.$transaction(async (tx) => {
    let data: any
    if (meta.type === "message") {
      data = await tx.message.findUnique({
        where: { id: meta.id },
        include: { author: true }
      })
      if (data) {
        // Update content
        await tx.message.update({
          where: { id: meta.id },
          data: { content }
        })

        // Update tags if tags are present in MD file
        if (tags.length > 0) {
          const { batchUpsertTags } = await import("@/lib/tag-utils")
          const tagIds = await batchUpsertTags(tags)

          // Delete existing tags and create new ones
          await tx.message.update({
            where: { id: meta.id },
            data: {
              tags: {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tagId }))
              }
            }
          })
        }
      }
    } else {
      data = await tx.comment.findUnique({
        where: { id: meta.id },
        include: { author: true }
      })
      if (data) {
        // Update content
        await tx.comment.update({
          where: { id: meta.id },
          data: { content }
        })

        // Update tags if tags are present in MD file
        if (tags.length > 0) {
          const { batchUpsertTags } = await import("@/lib/tag-utils")
          const tagIds = await batchUpsertTags(tags)

          // Delete existing tags and create new ones
          await tx.comment.update({
            where: { id: meta.id },
            data: {
              tags: {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tagId }))
              }
            }
          })
        }
      }
    }
    return data
  })

  if (!record) {
    console.log(`[SyncUtils] Record ${meta.type} ${meta.id} not found, skipping`)
    return
  }

  // 2. Update Workspace JSON with new modified time and tags
  meta.updated_at = lastModified
  meta.tags = tags.map(t => `#${t}`).join(" ")
  ws.workspace.lastSyncedAt = new Date().toISOString()
  saveWorkspaceData(workspaceId, ws)

  console.log(`[SyncUtils] Imported ${fileName} to DB with ${tags.length} tags`)

  // 3. Trigger RAGFlow Sync
  // Find workspace associated with this content
  let actualWorkspaceId: string | null = null
  if (meta.type === "message") {
    const msg = await prisma.message.findUnique({
      where: { id: meta.id },
      select: { workspaceId: true }
    })
    actualWorkspaceId = msg?.workspaceId || null
  } else if (meta.type === "comment") {
    // Comments need to get workspace through the associated message
    const comment = await prisma.comment.findUnique({
      where: { id: meta.id },
      select: { message: { select: { workspaceId: true } } }
    })
    actualWorkspaceId = comment?.message?.workspaceId || null
  }

  if (actualWorkspaceId) {
    await addTask("sync-ragflow", {
      userId: record.author?.id || "",
      workspaceId: actualWorkspaceId,
      messageId: meta.id,
      contentType: meta.type
    })
  }

  console.log(`[SyncUtils] Imported ${fileName} to DB and triggered RAGFlow sync`)
}

/**
 * Export all messages and comments to local files (organized by workspace)
 */
export async function exportAllToLocal(userId: string) {
  // Get all messages with their workspaces
  const messages = await prisma.message.findMany({
    where: { authorId: userId },
    include: {
      tags: { include: { tag: true } },
      author: true,
      workspace: true
    }
  })

  // Get all comments with their workspaces
  const comments = await prisma.comment.findMany({
    where: { authorId: userId },
    include: {
      tags: { include: { tag: true } },
      author: true,
      message: {
        select: {
          workspaceId: true,
          workspace: true
        }
      }
    }
  })

  // Group by workspace
  const workspaceGroups = new Map<string, { messages: any[], comments: any[] }>()

  for (const message of messages) {
    const wsId = message.workspaceId
    if (!wsId) continue // Skip messages without workspace
    if (!workspaceGroups.has(wsId)) {
      workspaceGroups.set(wsId, { messages: [], comments: [] })
    }
    workspaceGroups.get(wsId)!.messages.push(message)
  }

  for (const comment of comments) {
    const wsId = comment.message.workspaceId
    if (!wsId) continue // Skip comments without workspace
    if (!workspaceGroups.has(wsId)) {
      workspaceGroups.set(wsId, { messages: [], comments: [] })
    }
    workspaceGroups.get(wsId)!.comments.push(comment)
  }

  // Export to each workspace directory
  let totalMessages = 0
  let totalComments = 0
  const workspacesExported: string[] = []

  for (const [workspaceId, { messages: wsMessages, comments: wsComments }] of workspaceGroups) {
    for (const message of wsMessages) {
      await exportToLocal("message", message.id)
      totalMessages++
    }

    for (const comment of wsComments) {
      await exportToLocal("comment", comment.id)
      totalComments++
    }

    workspacesExported.push(workspaceId)
  }

  return {
    workspacesExported,
    messagesExported: totalMessages,
    commentsExported: totalComments
  }
}

/**
 * Import all modified files from local to DB (all workspaces)
 */
export async function importAllFromLocal() {
  const results = {
    workspacesProcessed: [] as string[],
    imported: 0,
    skipped: 0,
    errors: 0
  }

  // Get all workspace directories
  if (!fs.existsSync(SYNC_DIR)) {
    return results
  }

  const dirs = fs.readdirSync(SYNC_DIR, { withFileTypes: true })
  const workspaceDirs = dirs.filter(d => d.isDirectory() && !d.name.startsWith("."))

  for (const workspaceDir of workspaceDirs) {
    const workspaceId = workspaceDir.name
    const workspaceFile = getWorkspaceFile(workspaceId)

    if (!fs.existsSync(workspaceFile)) {
      continue
    }

    try {
      const ws = getWorkspaceData(workspaceId)
      results.workspacesProcessed.push(workspaceId)

      for (const [fileName, meta] of Object.entries(ws.files)) {
        try {
          const actualFileName = `${fileName}.md`
          const workspaceDirPath = getWorkspaceDir(workspaceId)
          const filePath = path.join(workspaceDirPath, actualFileName)

          if (!fs.existsSync(filePath)) {
            results.skipped++
            continue
          }

          const stats = fs.statSync(filePath)
          const lastModified = stats.mtime.toISOString()

          // Only import if modified
          if (meta.updated_at !== lastModified) {
            await importFromLocal(workspaceId, actualFileName)
            results.imported++
          } else {
            results.skipped++
          }
        } catch (error) {
          console.error(`[SyncUtils] Error importing ${fileName}:`, error)
          results.errors++
        }
      }
    } catch (error) {
      console.error(`[SyncUtils] Error processing workspace ${workspaceId}:`, error)
      results.errors++
    }
  }

  return results
}
