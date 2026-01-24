import * as fs from "fs"
import * as path from "path"
import prisma from "@/lib/prisma"
import { addTask } from "@/lib/queue"
import {
  getWorkspaceDir,
  getWorkspaceMetadataPath,
  readWorkspaceMetadata,
  getWorkspaceIdByFolderName,
  clearWorkspaceCache
} from "@/lib/workspace-discovery"

const SYNC_DIR = "D:\\Code\\whitenote-data\\link_md"

// Helper: Ensure directory exists
function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * ============================================================================
 * VERSION 2 SCHEMA INTERFACES
 * ============================================================================
 */

interface MessageMeta {
  id: string
  type: "message"
  originalFilename: string
  currentFilename: string
  commentFolderName: string
  created_at: string
  updated_at: string
  author: string
  authorName: string
  tags: string
}

interface CommentMeta {
  id: string
  type: "comment"
  messageId: string
  parentId: string | null
  originalFilename: string
  currentFilename: string
  folderName: string
  created_at: string
  updated_at: string
  author: string
  authorName: string
  tags: string
}

interface WorkspaceInfoV2 {
  id: string
  originalFolderName: string
  currentFolderName: string
  name: string
  lastSyncedAt: string
}

interface WorkspaceDataV2 {
  version: 2
  workspace: WorkspaceInfoV2
  messages: Record<string, MessageMeta>
  comments: Record<string, CommentMeta>
}

// Keep v1 interfaces for backward compatibility during transition
interface FileMeta {
  type: "message" | "comment"
  id: string
  created_at: string
  updated_at: string
  author: string
  authorName: string
  tags: string
  messageId: string | null
}

interface WorkspaceInfo {
  id: string
  name: string
  lastSyncedAt: string
}

interface Relations {
  [messageFileKey: string]: {
    type: "message"
    comments: string[]
  }
}

interface WorkspaceDataV1 {
  workspace: WorkspaceInfo
  files: Record<string, FileMeta>
  relations: Relations
}

type WorkspaceData = WorkspaceDataV2 | WorkspaceDataV1

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Get friendly name from first line of content (excluding tags)
 */
export function generateFriendlyName(content: string): string {
  // Get first non-empty line
  const lines = content.split('\n').filter(line => line.trim())
  const firstLine = lines[0] || ""

  // Remove tags from first line
  const withoutTags = firstLine.replace(/^#[\w\u4e00-\u9fa5]+(\s+)?/g, '').trim()

  // Use sanitized first line, or fallback to content substring
  let name = withoutTags || content.substring(0, 50).split(/\s+/)[0] || "untitled"

  // Sanitize: remove special chars, replace spaces with hyphens
  name = name
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)

  return name || "untitled"
}

/**
 * Get workspace.json file path for a specific workspace
 * Uses workspace-discovery utility for better performance
 */
function getWorkspaceFile(workspaceId: string): string {
  return getWorkspaceMetadataPath(workspaceId)
}

/**
 * Parse file path to determine type and IDs
 * Handles both original filenames (message_xyz.md) and friendly filenames (程序员鱼皮.md)
 */
export function parseFilePath(filePath: string): {
  workspaceId: string
  type: 'message' | 'comment'
  messageId?: string
  commentId?: string
  messageFilename?: string
  commentFolder?: string
  commentFilename?: string
} | null {
  const relativePath = path.relative(SYNC_DIR, filePath)
  const parts = relativePath.split(path.sep)

  if (parts.length < 2) return null

  // parts[0] = workspace folder (could be renamed)
  // parts[1] = message file OR message comment folder
  // parts[2...] = nested comment structure

  // Helper: Find workspaceId by friendly folder name using workspace-discovery
  function getWorkspaceIdFromFolderName(folderName: string): string | null {
    return getWorkspaceIdByFolderName(folderName)
  }

  if (parts.length === 2 && parts[1].endsWith('.md')) {
    // Direct message file in workspace root
    const fileName = parts[1]
    const folderName = parts[0]
    const workspaceId = getWorkspaceIdFromFolderName(folderName)

    if (!workspaceId) {
      console.log(`[parseFilePath] Could not find workspaceId for folder '${folderName}'`)
      return null
    }

    // First check if it's an original filename (message_xyz.md)
    if (fileName.startsWith('message_')) {
      return {
        workspaceId,
        type: 'message',
        messageId: fileName.replace('message_', '').replace('.md', ''),
        messageFilename: fileName
      }
    }

    // Otherwise, look up in workspace.json to find the message by currentFilename
    try {
      const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
      if (ws.version === 2) {
        // Find message with matching currentFilename
        for (const [_originalFilename, message] of Object.entries(ws.messages)) {
          if (message.currentFilename === fileName) {
            return {
              workspaceId,
              type: 'message',
              messageId: message.id,
              messageFilename: fileName
            }
          }
        }

        // Fallback: If only one message exists in workspace, assume it was manually renamed
        // This handles the case where user manually renames a message file
        const messageEntries = Object.values(ws.messages)
        if (messageEntries.length === 1) {
          const message = messageEntries[0]
          console.log(`[parseFilePath] Assuming manually renamed message: '${message.currentFilename}' -> '${fileName}'`)
          return {
            workspaceId,
            type: 'message',
            messageId: message.id,
            messageFilename: fileName
          }
        } else if (messageEntries.length > 1) {
          console.log(`[parseFilePath] Multiple messages exist, cannot identify renamed file: ${fileName}`)
        }
      }
    } catch {
      // Fall through to return null
    }
  }

  if (parts.length >= 3 && parts[parts.length - 1].endsWith('.md')) {
    // Comment in subfolder
    const folderName = parts[0]
    const workspaceId = getWorkspaceIdFromFolderName(folderName)

    if (!workspaceId) {
      console.log(`[parseFilePath] Could not find workspaceId for folder '${folderName}'`)
      return null
    }

    const messageFolder = parts[1] // Could be message filename or friendly folder name
    const commentSubfolder = parts[2] // e.g., "great-reply"
    const commentFileName = parts[parts.length - 1] // e.g., "comment_abc123.md" or friendly name

    // Look up in workspace.json to find the comment
    try {
      const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
      if (ws.version === 2) {
        // Find comment by matching currentFilename
        for (const [_originalFilename, comment] of Object.entries(ws.comments)) {
          if (comment.currentFilename === commentFileName && comment.folderName === commentSubfolder) {
            return {
              workspaceId,
              type: 'comment',
              messageId: comment.messageId,
              commentId: comment.id,
              messageFilename: messageFolder,
              commentFolder: commentSubfolder,
              commentFilename: commentFileName
            }
          }
        }
      }
    } catch {
      // Fall through
    }

    // Fallback 1: try to extract ID from original filename format
    if (commentFileName.startsWith('comment_')) {
      const commentId = commentFileName.replace('comment_', '').replace('.md', '')
      return {
        workspaceId,
        type: 'comment',
        messageId: messageFolder.replace('message_', '').replace('.md', ''),
        commentId,
        messageFilename: messageFolder,
        commentFolder: commentSubfolder,
        commentFilename: commentFileName
      }
    }

    // Fallback 2: file is in a comment folder (parts.length === 3), find comment by folder name
    // This handles manually renamed comment files (e.g., test_yupi_03.md -> test_yupi_04.md)
    if (parts.length === 3) {
      const commentSubfolder = parts[1] // e.g., "鱼皮"
      const commentFileName = parts[2] // e.g., "test_yupi_04.md"

      try {
        const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
        if (ws.version === 2) {
          // Find any comment with this folderName
          for (const [_originalFilename, comment] of Object.entries(ws.comments)) {
            if (comment.folderName === commentSubfolder) {
              console.log(`[parseFilePath] Found comment via folder name: ${commentSubfolder}, assuming file rename: ${commentFileName}`)
              return {
                workspaceId,
                type: 'comment',
                messageId: comment.messageId,
                commentId: comment.id,
                messageFilename: messageFolder,
                commentFolder: commentSubfolder,
                commentFilename: commentFileName
              }
            }
          }
        }
      } catch {
        // Fall through
      }
    }
  }

  return null
}

/**
 * ============================================================================
 * WORKSPACE DATA MANAGEMENT
 * ============================================================================
 */

/**
 * Read Workspace JSON for a specific workspace
 * Uses workspace-discovery utility for better performance
 */
export function getWorkspaceData(workspaceId: string): WorkspaceData {
  const data = readWorkspaceMetadata(workspaceId)

  if (!data) {
    // Return default v2 structure
    return {
      version: 2,
      workspace: {
        id: workspaceId,
        originalFolderName: workspaceId,
        currentFolderName: workspaceId,
        name: "",
        lastSyncedAt: new Date().toISOString()
      },
      messages: {},
      comments: {}
    }
  }

  // If v1, migrate to v2
  if (!data.version || data.version < 2) {
    return migrateV1ToV2(data as WorkspaceDataV1, workspaceId)
  }

  return data as WorkspaceDataV2
}

/**
 * Migrate v1 schema to v2
 */
function migrateV1ToV2(v1: WorkspaceDataV1, workspaceId: string): WorkspaceDataV2 {
  const v2: WorkspaceDataV2 = {
    version: 2,
    workspace: {
      id: v1.workspace.id,
      originalFolderName: workspaceId,
      currentFolderName: workspaceId,
      name: v1.workspace.name,
      lastSyncedAt: v1.workspace.lastSyncedAt
    },
    messages: {},
    comments: {}
  }

  // Convert files to messages/comments
  for (const [fileKey, fileMeta] of Object.entries(v1.files)) {
    if (fileMeta.type === 'message') {
      v2.messages[fileKey] = {
        id: fileMeta.id,
        type: 'message',
        originalFilename: `${fileKey}.md`,
        currentFilename: `${fileKey}.md`,
        commentFolderName: fileKey,
        created_at: fileMeta.created_at,
        updated_at: fileMeta.updated_at,
        author: fileMeta.author,
        authorName: fileMeta.authorName,
        tags: fileMeta.tags
      }
    } else if (fileMeta.type === 'comment') {
      v2.comments[fileKey] = {
        id: fileMeta.id,
        type: 'comment',
        messageId: fileMeta.messageId || '',
        parentId: null,
        originalFilename: `${fileKey}.md`,
        currentFilename: `${fileKey}.md`,
        folderName: fileKey,
        created_at: fileMeta.created_at,
        updated_at: fileMeta.updated_at,
        author: fileMeta.author,
        authorName: fileMeta.authorName,
        tags: fileMeta.tags
      }
    }
  }

  return v2
}

/**
 * Write Workspace JSON for a specific workspace
 * Uses workspace-discovery utility for better performance
 */
function saveWorkspaceData(workspaceId: string, data: WorkspaceData) {
  const { writeWorkspaceMetadata } = require("@/lib/workspace-discovery")
  const workspaceDir = getWorkspaceDir(workspaceId)

  // Ensure directories exist before writing
  const metaDir = path.join(workspaceDir, ".whitenote")
  ensureDirectoryExists(metaDir)

  // Write using workspace-discovery utility (auto-clears cache)
  writeWorkspaceMetadata(workspaceId, data)

  console.log(`[SyncUtils] Saved workspace data for ${workspaceId}`)
}

/**
 * ============================================================================
 * PARSE MD FILE
 * ============================================================================
 */

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
 * ============================================================================
 * EXPORT: DB -> Local File
 * ============================================================================
 */

/**
 * Export message or comment to local file
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

  const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2

  if (type === "message") {
    // ========== MESSAGE EXPORT ==========
    const originalFilename = `message_${data.id}.md`
    const friendlyName = generateFriendlyName(data.content)
    const currentFilename = `${friendlyName}.md`

    const filePath = path.join(workspaceDir, currentFilename)

    // Write file
    fs.writeFileSync(filePath, fileContent)

    // Update workspace.json
    ws.workspace.id = workspaceId
    ws.workspace.name = data.workspace?.name || ""
    ws.workspace.lastSyncedAt = new Date().toISOString()

    ws.messages[originalFilename] = {
      id: data.id,
      type: "message",
      originalFilename: originalFilename,
      currentFilename: currentFilename,
      commentFolderName: originalFilename.replace('.md', ''),
      created_at: data.createdAt.toISOString(),
      updated_at: new Date().toISOString(),
      author: data.author?.email || "unknown",
      authorName: data.author?.name || "Unknown",
      tags: tagString
    }

    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Exported message ${id} to ${workspaceId}/${currentFilename}`)
  } else {
    // ========== COMMENT EXPORT ==========
    // Get message filename to create comment folder
    const messageFilename = `message_${data.messageId}.md`
    let commentFolderName = ws.messages[messageFilename]?.commentFolderName || messageFilename.replace('.md', '')

    // Check if the folder from workspace.json exists
    const defaultCommentFolderPath = path.join(workspaceDir, commentFolderName)

    if (!fs.existsSync(defaultCommentFolderPath)) {
      // Folder was manually renamed, scan for the actual folder
      console.log(`[SyncUtils] Comment folder '${commentFolderName}' not found, scanning for renamed folder...`)

      try {
        const dirs = fs.readdirSync(workspaceDir, { withFileTypes: true })
        const subdirs = dirs.filter(d => d.isDirectory() && d.name !== '.whitenote')

        // Check each subfolder to see if it contains comments for this message
        for (const subdir of subdirs) {
          const subdirPath = path.join(workspaceDir, subdir.name)

          // Read files in this subfolder
          const files = fs.readdirSync(subdirPath)
          const mdFiles = files.filter(f => f.endsWith('.md'))

          if (mdFiles.length === 0) continue

          // Check if any of these .md files are comments for this message
          // by looking them up in workspace.json
          let foundMessageFolder = false

          for (const mdFile of mdFiles) {
            // Find the comment in workspace.json
            const commentEntry = Object.values(ws.comments).find(
              c => c.currentFilename === mdFile
            )

            if (commentEntry && commentEntry.messageId === data.messageId) {
              console.log(`[SyncUtils] Found renamed comment folder '${subdir.name}' via file '${mdFile}'`)
              commentFolderName = subdir.name
              foundMessageFolder = true

              // Update folderName for all comments of this message in workspace.json
              console.log(`[SyncUtils] Updating folderName for all comments of message ${data.messageId}`)
              for (const [_key, comment] of Object.entries(ws.comments)) {
                if (comment.messageId === data.messageId && comment.folderName !== subdir.name) {
                  console.log(`[SyncUtils]   - Updating comment ${comment.id}: '${comment.folderName}' -> '${subdir.name}'`)
                  comment.folderName = subdir.name
                }
              }

              // Update the message's commentFolderName as well
              if (ws.messages[messageFilename]) {
                console.log(`[SyncUtils] Updating message commentFolderName: '${ws.messages[messageFilename].commentFolderName}' -> '${subdir.name}'`)
                ws.messages[messageFilename].commentFolderName = subdir.name
              }

              break
            }
          }

          if (foundMessageFolder) break
        }
      } catch (error) {
        console.error('[SyncUtils] Error scanning for renamed comment folder:', error)
      }
    }

    // Create comment folder if it doesn't exist
    const commentFolderPath = path.join(workspaceDir, commentFolderName)
    ensureDirectoryExists(commentFolderPath)

    const originalFilename = `comment_${data.id}.md`
    const friendlyName = generateFriendlyName(data.content)
    const currentFilename = `${friendlyName}.md`

    const filePath = path.join(commentFolderPath, currentFilename)

    // Write file
    fs.writeFileSync(filePath, fileContent)

    // Update workspace.json
    ws.workspace.id = workspaceId
    ws.workspace.name = data.message?.workspace?.name || ""
    ws.workspace.lastSyncedAt = new Date().toISOString()

    ws.comments[originalFilename] = {
      id: data.id,
      type: "comment",
      messageId: data.messageId,
      parentId: data.parentId,
      originalFilename: originalFilename,
      currentFilename: currentFilename,
      folderName: commentFolderName,
      created_at: data.createdAt.toISOString(),
      updated_at: new Date().toISOString(),
      author: data.author?.email || "unknown",
      authorName: data.author?.name || "Unknown",
      tags: tagString
    }

    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Exported comment ${id} to ${workspaceId}/${commentFolderName}/${currentFilename}`)
  }
}

/**
 * ============================================================================
 * IMPORT: Local File -> DB
 * ============================================================================
 */

/**
 * Import from local file to DB
 */
export async function importFromLocal(workspaceId: string, filePath: string) {
  const parsed = parseFilePath(filePath)
  if (!parsed) {
    console.log(`[SyncUtils] Could not parse file path ${filePath}, skipping`)
    return
  }

  const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
  let meta: MessageMeta | CommentMeta | undefined
  let originalFilename: string

  if (parsed.type === 'message') {
    originalFilename = `message_${parsed.messageId}.md`
    meta = ws.messages[originalFilename]
  } else {
    originalFilename = `comment_${parsed.commentId}.md`
    meta = ws.comments[originalFilename]

    // Fallback: if not found by ID, try to find by folderName and currentFilename
    // This handles manually renamed comment files where we need to match the actual filename
    if (!meta && parsed.commentFolder && parsed.commentFilename) {
      for (const [_key, comment] of Object.entries(ws.comments)) {
        if (comment.folderName === parsed.commentFolder && comment.currentFilename === parsed.commentFilename) {
          console.log(`[SyncUtils] Found comment by folder+filename: ${parsed.commentFolder}/${parsed.commentFilename}`)
          meta = comment
          break
        }
      }
    }
  }

  if (!meta) {
    console.log(`[SyncUtils] Unknown file ${filePath} in workspace ${workspaceId}, skipping`)
    return
  }

  if (!fs.existsSync(filePath)) {
    console.log(`[SyncUtils] File ${filePath} not found, skipping`)
    return
  }

  const stats = fs.statSync(filePath)
  const lastModified = stats.mtime.toISOString()

  // Check if file was actually modified
  if (meta.updated_at === lastModified) {
    console.log(`[SyncUtils] File ${filePath} not modified, skipping`)
    return
  }

  const contentRaw = fs.readFileSync(filePath, "utf-8")
  const { tags, content } = parseMdFile(contentRaw)

  // Update DB Content and Tags
  const record = await prisma.$transaction(async (tx) => {
    let data: any
    if (meta!.type === "message") {
      data = await tx.message.findUnique({
        where: { id: meta!.id },
        include: { author: true }
      })
      if (data) {
        await tx.message.update({
          where: { id: meta!.id },
          data: { content }
        })

        const { batchUpsertTags } = await import("@/lib/tag-utils")
        const tagIds = tags.length > 0 ? await batchUpsertTags(tags) : []

        await tx.message.update({
          where: { id: meta!.id },
          data: {
            tags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId }))
            }
          }
        })
      }
    } else {
      data = await tx.comment.findUnique({
        where: { id: (meta as CommentMeta).id },
        include: { author: true }
      })
      if (data) {
        await tx.comment.update({
          where: { id: (meta as CommentMeta).id },
          data: { content }
        })

        const { batchUpsertTags } = await import("@/lib/tag-utils")
        const tagIds = tags.length > 0 ? await batchUpsertTags(tags) : []

        await tx.comment.update({
          where: { id: (meta as CommentMeta).id },
          data: {
            tags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId }))
            }
          }
        })
      }
    }
    return data
  })

  if (!record) {
    console.log(`[SyncUtils] Record ${meta.type} ${meta.id} not found, skipping`)
    return
  }

  // Update currentFilename if file was manually renamed
  const actualFileName = parsed.type === 'message' ? parsed.messageFilename : parsed.commentFilename
  if (actualFileName && meta.currentFilename !== actualFileName) {
    console.log(`[SyncUtils] Updating currentFilename: '${meta.currentFilename}' -> '${actualFileName}'`)
    meta.currentFilename = actualFileName
  }

  // Update Workspace JSON with new modified time and tags
  meta.updated_at = lastModified
  meta.tags = tags.map(t => `#${t}`).join(" ")
  ws.workspace.lastSyncedAt = new Date().toISOString()
  saveWorkspaceData(workspaceId, ws)

  console.log(`[SyncUtils] Imported ${filePath} to DB with ${tags.length} tags`)

  // Trigger RAGFlow Sync
  let actualWorkspaceId: string | null = null
  if (meta.type === "message") {
    const msg = await prisma.message.findUnique({
      where: { id: meta.id },
      select: { workspaceId: true }
    })
    actualWorkspaceId = msg?.workspaceId || null
  } else if (meta.type === "comment") {
    const comment = await prisma.comment.findUnique({
      where: { id: (meta as CommentMeta).id },
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

  console.log(`[SyncUtils] Imported ${filePath} to DB and triggered RAGFlow sync`)
}

/**
 * ============================================================================
 * BULK OPERATIONS
 * ============================================================================
 */

/**
 * Export all messages and comments to local files
 */
export async function exportAllToLocal(userId: string) {
  const messages = await prisma.message.findMany({
    where: { authorId: userId },
    include: {
      tags: { include: { tag: true } },
      author: true,
      workspace: true
    }
  })

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

  const workspaceGroups = new Map<string, { messages: any[], comments: any[] }>()

  for (const message of messages) {
    const wsId = message.workspaceId
    if (!wsId) continue
    if (!workspaceGroups.has(wsId)) {
      workspaceGroups.set(wsId, { messages: [], comments: [] })
    }
    workspaceGroups.get(wsId)!.messages.push(message)
  }

  for (const comment of comments) {
    const wsId = comment.message.workspaceId
    if (!wsId) continue
    if (!workspaceGroups.has(wsId)) {
      workspaceGroups.set(wsId, { messages: [], comments: [] })
    }
    workspaceGroups.get(wsId)!.comments.push(comment)
  }

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
 * Import all modified files from local to DB
 */
export async function importAllFromLocal() {
  const results = {
    workspacesProcessed: [] as string[],
    imported: 0,
    skipped: 0,
    errors: 0
  }

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
      const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
      if (ws.version !== 2) continue

      results.workspacesProcessed.push(workspaceId)

      // Process message files by scanning actual directory
      const workspaceDirPath = getWorkspaceDir(workspaceId)
      const processedMessages = new Set<string>()

      try {
        const files = fs.readdirSync(workspaceDirPath)
        const mdFiles = files.filter(f => f.endsWith('.md'))

        for (const mdFile of mdFiles) {
          const filePath = path.join(workspaceDirPath, mdFile)

          // Check if this file is in workspace.json
          let messageEntry = Object.values(ws.messages).find(
            m => m.currentFilename === mdFile
          )

          // Fallback: if not found, try to find by first message (handles manually renamed files)
          if (!messageEntry && Object.values(ws.messages).length === 1) {
            messageEntry = Object.values(ws.messages)[0]
            console.log(`[SyncUtils] Found message '${mdFile}' by fallback (only one message exists), assuming manual rename from '${messageEntry.currentFilename}'`)
          }

          if (!messageEntry) {
            // Unknown file, skip
            results.skipped++
            continue
          }

          // Mark this message as processed
          processedMessages.add(messageEntry.id)

          try {
            const stats = fs.statSync(filePath)
            const lastModified = stats.mtime.toISOString()

            if (messageEntry.updated_at !== lastModified) {
              await importFromLocal(workspaceId, filePath)
              results.imported++
            } else {
              results.skipped++
            }
          } catch (error) {
            console.error(`[SyncUtils] Error importing ${mdFile}:`, error)
            results.errors++
          }
        }
      } catch (error) {
        console.error(`[SyncUtils] Error reading workspace directory:`, error)
      }

      // Process comment files by scanning actual directories
      const dirs = fs.readdirSync(workspaceDirPath, { withFileTypes: true })
      const commentFolders = dirs.filter(d => d.isDirectory() && d.name !== '.whitenote')
      const processedComments = new Set<string>()

      for (const folder of commentFolders) {
        const folderPath = path.join(workspaceDirPath, folder.name)
        try {
          const files = fs.readdirSync(folderPath)
          const mdFiles = files.filter(f => f.endsWith('.md'))

          for (const mdFile of mdFiles) {
            const filePath = path.join(folderPath, mdFile)

            // Check if this file is in workspace.json
            let commentEntry = Object.values(ws.comments).find(
              c => c.folderName === folder.name && c.currentFilename === mdFile
            )

            // Fallback: if not found, try to find by folderName only (handles manually renamed files)
            if (!commentEntry) {
              commentEntry = Object.values(ws.comments).find(
                c => c.folderName === folder.name && !processedComments.has(c.id)
              )
              if (commentEntry) {
                console.log(`[SyncUtils] Found comment '${mdFile}' by folderName only, assuming manual rename from '${commentEntry.currentFilename}'`)
              }
            }

            if (!commentEntry) {
              // Unknown file, skip
              results.skipped++
              continue
            }

            // Mark this comment as processed
            processedComments.add(commentEntry.id)

            try {
              const stats = fs.statSync(filePath)
              const lastModified = stats.mtime.toISOString()

              if (commentEntry.updated_at !== lastModified) {
                await importFromLocal(workspaceId, filePath)
                results.imported++
              } else {
                results.skipped++
              }
            } catch (error) {
              console.error(`[SyncUtils] Error importing ${mdFile}:`, error)
              results.errors++
            }
          }
        } catch (error) {
          console.error(`[SyncUtils] Error reading folder ${folder.name}:`, error)
        }
      }
    } catch (error) {
      console.error(`[SyncUtils] Error processing workspace ${workspaceId}:`, error)
      results.errors++
    }
  }

  return results
}

/**
 * ============================================================================
 * DELETE OPERATIONS
 * ============================================================================
 */

/**
 * Delete local file and update workspace.json
 */
export async function deleteLocalFile(type: "message" | "comment", id: string, workspaceId: string) {
  const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
  const workspaceDir = getWorkspaceDir(workspaceId)

  if (type === "message") {
    const originalFilename = `message_${id}.md`
    const message = ws.messages[originalFilename]
    if (!message) return

    // Delete message file
    const filePath = path.join(workspaceDir, message.currentFilename)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        console.log(`[SyncUtils] Deleted message file: ${filePath}`)
      } catch (error) {
        console.error(`[SyncUtils] Failed to delete ${filePath}:`, error)
      }
    }

    // Delete comment folder if exists
    const commentFolderPath = path.join(workspaceDir, message.commentFolderName)
    if (fs.existsSync(commentFolderPath)) {
      try {
        fs.rmSync(commentFolderPath, { recursive: true, force: true })
        console.log(`[SyncUtils] Deleted comment folder: ${commentFolderPath}`)
      } catch (error) {
        console.error(`[SyncUtils] Failed to delete ${commentFolderPath}:`, error)
      }
    }

    // Remove from workspace.json
    delete ws.messages[originalFilename]
    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Updated workspace.json for message ${id}`)
  } else {
    const originalFilename = `comment_${id}.md`
    const comment = ws.comments[originalFilename]
    if (!comment) return

    // Delete comment file
    const filePath = path.join(workspaceDir, comment.folderName, comment.currentFilename)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        console.log(`[SyncUtils] Deleted comment file: ${filePath}`)
      } catch (error) {
        console.error(`[SyncUtils] Failed to delete ${filePath}:`, error)
      }
    }

    // Remove from workspace.json
    delete ws.comments[originalFilename]
    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Updated workspace.json for comment ${id}`)
  }
}

/**
 * ============================================================================
 * RENAME FUNCTIONS
 * ============================================================================
 */

/**
 * Rename workspace folder
 */
export async function renameWorkspaceFolder(
  workspaceId: string,
  newFolderName: string
): Promise<boolean> {
  const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
  const oldPath = getWorkspaceDir(workspaceId)
  const newPath = path.join(SYNC_DIR, newFolderName)

  try {
    fs.renameSync(oldPath, newPath)
    ws.workspace.currentFolderName = newFolderName
    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Renamed workspace folder: ${oldPath} -> ${newPath}`)
    return true
  } catch (error) {
    console.error(`[SyncUtils] Failed to rename workspace folder:`, error)
    return false
  }
}

/**
 * Rename message file
 */
export async function renameMessageFile(
  workspaceId: string,
  messageId: string,
  newFileName: string
): Promise<boolean> {
  const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
  const originalFilename = `message_${messageId}.md`
  const message = ws.messages[originalFilename]
  if (!message) {
    console.error(`[SyncUtils] Message ${messageId} not found in workspace ${workspaceId}`)
    return false
  }

  const workspaceDir = getWorkspaceDir(workspaceId)
  const oldPath = path.join(workspaceDir, message.currentFilename)
  const newPath = path.join(workspaceDir, newFileName)

  try {
    fs.renameSync(oldPath, newPath)
    message.currentFilename = newFileName
    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Renamed message file: ${oldPath} -> ${newPath}`)
    return true
  } catch (error) {
    console.error(`[SyncUtils] Failed to rename message file:`, error)
    return false
  }
}

/**
 * Rename comment folder
 */
export async function renameCommentFolder(
  workspaceId: string,
  commentId: string,
  newFolderName: string
): Promise<boolean> {
  const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
  const originalFilename = `comment_${commentId}.md`
  const comment = ws.comments[originalFilename]
  if (!comment) {
    console.error(`[SyncUtils] Comment ${commentId} not found in workspace ${workspaceId}`)
    return false
  }

  const workspaceDir = getWorkspaceDir(workspaceId)
  const oldPath = path.join(workspaceDir, comment.folderName)
  const newPath = path.join(workspaceDir, newFolderName)

  try {
    fs.renameSync(oldPath, newPath)
    comment.folderName = newFolderName
    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Renamed comment folder: ${oldPath} -> ${newPath}`)
    return true
  } catch (error) {
    console.error(`[SyncUtils] Failed to rename comment folder:`, error)
    return false
  }
}

/**
 * Rename comment file
 */
export async function renameCommentFile(
  workspaceId: string,
  commentId: string,
  newFileName: string
): Promise<boolean> {
  const ws = getWorkspaceData(workspaceId) as WorkspaceDataV2
  const originalFilename = `comment_${commentId}.md`
  const comment = ws.comments[originalFilename]
  if (!comment) {
    console.error(`[SyncUtils] Comment ${commentId} not found in workspace ${workspaceId}`)
    return false
  }

  const workspaceDir = getWorkspaceDir(workspaceId)
  const oldPath = path.join(workspaceDir, comment.folderName, comment.currentFilename)
  const newPath = path.join(workspaceDir, comment.folderName, newFileName)

  try {
    fs.renameSync(oldPath, newPath)
    comment.currentFilename = newFileName
    saveWorkspaceData(workspaceId, ws)
    console.log(`[SyncUtils] Renamed comment file: ${oldPath} -> ${newPath}`)
    return true
  } catch (error) {
    console.error(`[SyncUtils] Failed to rename comment file:`, error)
    return false
  }
}
