import * as fs from "fs"
import * as path from "path"
import prisma from "@/lib/prisma"
import { addTask } from "@/lib/queue"
import redis from "@/lib/redis"
import {
  getWorkspaceDir,
  getWorkspaceMetadataPath,
  readWorkspaceMetadata,
  getWorkspaceIdByFolderName
} from "@/lib/workspace-discovery"

// 获取同步目录，支持 Docker 和本地开发环境
function getSyncDir(): string {
  const envDir = process.env.FILE_WATCHER_DIR
  if (envDir) {
    return envDir
  }
  // 默认使用相对于项目根目录的路径
  return path.join(process.cwd(), "data", "link_md")
}

const SYNC_DIR = getSyncDir()

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

type WorkspaceData = WorkspaceDataV2

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
 * Sanitize workspace name for use as folder name
 * Preserves meaningful characters while removing filesystem-unsafe chars
 */
export function sanitizeFolderName(name: string): string {
  if (!name || name.trim() === '') {
    return 'untitled-workspace'
  }

  // Remove filesystem-unsafe characters
  let sanitized = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove unsafe chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .trim()

  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100)
  }

  // Fallback if result is empty
  if (!sanitized) {
    return 'untitled-workspace'
  }

  return sanitized
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
      const ws = getWorkspaceData(workspaceId)
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
      const ws = getWorkspaceData(workspaceId)
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
        const ws = getWorkspaceData(workspaceId)
        // Find comment by folderName AND currentFilename to ensure we get the right comment
        for (const [_originalFilename, comment] of Object.entries(ws.comments)) {
          if (comment.folderName === commentSubfolder && comment.currentFilename === commentFileName) {
            console.log(`[parseFilePath] Found comment via folder+filename: ${commentSubfolder}/${commentFileName} -> ${comment.id}`)
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

        // Fallback: If no exact match found, try matching by folderName only (for backward compatibility)
        // But log a warning to help identify the issue
        console.warn(`[parseFilePath] No exact match found for ${commentSubfolder}/${commentFileName}, trying folderName match only`)
        for (const [_originalFilename, comment] of Object.entries(ws.comments)) {
          if (comment.folderName === commentSubfolder) {
            console.warn(`[parseFilePath] WARNING: Using first matching comment with folderName ${commentSubfolder}: ${comment.id}`)
            console.warn(`[parseFilePath] This may cause data to be imported to the wrong comment!`)
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
 * Only supports V2 schema
 */
export function getWorkspaceData(workspaceId: string): WorkspaceDataV2 {
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

  // Only support V2 schema
  if (data.version !== 2) {
    throw new Error(`Unsupported workspace.json version: ${data.version}. Expected version 2.`)
  }

  return data
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
  const lines = content.split(/\r?\n/)
  const firstLine = lines[0] || ""
  const body = lines.slice(1).join("\n").trimStart()

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

  // Get workspace data first to check if it exists
  const ws = getWorkspaceData(workspaceId)

  // For new workspaces, initialize the directory with a friendly name
  // before calling getWorkspaceDir
  const workspaceName = data.workspace?.name || workspaceId
  if (!ws.workspace.id || ws.workspace.originalFolderName === workspaceId) {
    // This is a new or uninitialized workspace, create directory with friendly name
    const sanitizedFolderName = sanitizeFolderName(workspaceName)
    const workspaceDir = path.join(SYNC_DIR, sanitizedFolderName)

    console.log(`[SyncUtils] Initializing new workspace directory: ${workspaceId} -> "${sanitizedFolderName}"`)

    ensureDirectoryExists(workspaceDir)

    // Initialize workspace.json with proper folder names
    ws.workspace.id = workspaceId
    ws.workspace.originalFolderName = sanitizedFolderName
    ws.workspace.currentFolderName = sanitizedFolderName
    ws.workspace.name = workspaceName
    ws.workspace.lastSyncedAt = new Date().toISOString()

    // Write workspace.json immediately to establish the mapping
    saveWorkspaceData(workspaceId, ws)

    // Clear cache to ensure new workspace is discoverable
    const { clearWorkspaceCache } = require("@/lib/workspace-discovery")
    clearWorkspaceCache()
  }

  // Now get the workspace directory (it will use the friendly name we just set up)
  const workspaceDir = getWorkspaceDir(workspaceId)

  if (type === "message") {
    // ========== MESSAGE EXPORT ==========
    const originalFilename = `message_${data.id}.md`

    // Check if this message already has a filename in workspace.json
    // If yes, use the existing filename to avoid creating new files on edit
    const existingMessageMeta = ws.messages[originalFilename]
    let currentFilename: string

    if (existingMessageMeta?.currentFilename) {
      // Use existing filename to preserve file on edit
      currentFilename = existingMessageMeta.currentFilename
      console.log(`[SyncUtils] Using existing filename for message ${id}: ${currentFilename}`)
    } else {
      // Generate new friendly filename for first-time export
      const friendlyName = generateFriendlyName(data.content)
      currentFilename = `${friendlyName}.md`
      console.log(`[SyncUtils] Generated new filename for message ${id}: ${currentFilename}`)
    }

    const filePath = path.join(workspaceDir, currentFilename)

    // Check if file content has actually changed
    let shouldWrite = true
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, "utf-8")
      if (existingContent === fileContent) {
        shouldWrite = false
        console.log(`[SyncUtils] File content unchanged, skipping write: ${currentFilename}`)
      }
    }

    if (shouldWrite) {
      // Pause file watcher to prevent it from importing the file we just exported
      // This avoids the "too recent" skip issue and circular sync
      await redis.set("file-watcher:paused", "1", "EX", 5) // Pause for 5 seconds

      // Write file
      fs.writeFileSync(filePath, fileContent)
    }

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

    // Check if this comment already has a filename in workspace.json
    // If yes, use the existing filename to avoid creating new files on edit
    const existingCommentMeta = ws.comments[originalFilename]
    let currentFilename: string

    if (existingCommentMeta?.currentFilename) {
      // Use existing filename to preserve file on edit
      currentFilename = existingCommentMeta.currentFilename
      console.log(`[SyncUtils] Using existing filename for comment ${id}: ${currentFilename}`)
    } else {
      // Generate new friendly filename for first-time export
      // Include comment ID suffix to ensure uniqueness
      const friendlyName = generateFriendlyName(data.content)
      const idSuffix = data.id.slice(-6) // Last 6 chars of comment ID for uniqueness
      currentFilename = `${friendlyName}-${idSuffix}.md`
      console.log(`[SyncUtils] Generated new filename for comment ${id}: ${currentFilename}`)
    }

    const filePath = path.join(commentFolderPath, currentFilename)

    // Check if file content has actually changed
    let shouldWrite = true
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, "utf-8")
      if (existingContent === fileContent) {
        shouldWrite = false
        console.log(`[SyncUtils] File content unchanged, skipping write: ${currentFilename}`)
      }
    }

    if (shouldWrite) {
      // Pause file watcher to prevent it from importing the file we just exported
      // This avoids the "too recent" skip issue and circular sync
      await redis.set("file-watcher:paused", "1", "EX", 5) // Pause for 5 seconds

      // Write file
      fs.writeFileSync(filePath, fileContent)
    }

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
  // Pause file watcher during import to prevent race conditions
  await redis.set("file-watcher:paused", "1", "EX", 3)

  const parsed = parseFilePath(filePath)
  if (!parsed) {
    console.log(`[SyncUtils] Could not parse file path ${filePath}, skipping`)
    return
  }

  const ws = getWorkspaceData(workspaceId)
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

  const workspaceGroups = new Map<string, { messages: any[], comments: any[], workspaceName: string }>()

  for (const message of messages) {
    const wsId = message.workspaceId
    if (!wsId) continue
    if (!workspaceGroups.has(wsId)) {
      const wsName = message.workspace?.name || wsId
      console.log(`[SyncUtils] Found workspace for messages: ${wsId} -> ${wsName}`)
      workspaceGroups.set(wsId, { messages: [], comments: [], workspaceName: wsName })
    }
    workspaceGroups.get(wsId)!.messages.push(message)
  }

  for (const comment of comments) {
    const wsId = comment.message.workspaceId
    if (!wsId) continue
    if (!workspaceGroups.has(wsId)) {
      const wsName = comment.message.workspace?.name || wsId
      console.log(`[SyncUtils] Found workspace for comments: ${wsId} -> ${wsName}`)
      workspaceGroups.set(wsId, { messages: [], comments: [], workspaceName: wsName })
    }
    workspaceGroups.get(wsId)!.comments.push(comment)
  }

  // ============================================================
  // PRE-CREATE ALL WORKSPACE DIRECTORIES WITH MEANINGFUL NAMES
  // ============================================================

  console.log(`[SyncUtils] Pre-creating ${workspaceGroups.size} workspace directories...`)

  for (const [workspaceId, { workspaceName }] of workspaceGroups) {
    const sanitizedFolderName = sanitizeFolderName(workspaceName)
    const workspaceDir = path.join(SYNC_DIR, sanitizedFolderName)

    console.log(`[SyncUtils] Workspace: ${workspaceId} -> "${workspaceName}" -> "${sanitizedFolderName}"`)

    // Create directory if it doesn't exist
    if (!fs.existsSync(workspaceDir)) {
      ensureDirectoryExists(workspaceDir)
      console.log(`[SyncUtils] Created workspace directory: ${sanitizedFolderName}`)
    }

    // Create .whitenote directory
    const metaDir = path.join(workspaceDir, ".whitenote")
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true })
    }

    // Write workspace.json directly to establish the mapping
    const workspaceJsonPath = path.join(metaDir, "workspace.json")
    const workspaceData = {
      version: 2,
      workspace: {
        id: workspaceId,
        originalFolderName: sanitizedFolderName,
        currentFolderName: sanitizedFolderName,
        name: workspaceName,
        lastSyncedAt: new Date().toISOString()
      },
      messages: {},
      comments: {}
    }

    fs.writeFileSync(workspaceJsonPath, JSON.stringify(workspaceData, null, 2))
    console.log(`[SyncUtils] ✓ Initialized workspace metadata for: ${sanitizedFolderName} (${workspaceId})`)
  }

  // Clear cache to ensure new mappings are discovered
  const { clearWorkspaceCache } = require("@/lib/workspace-discovery")
  clearWorkspaceCache()

  // ============================================================
  // NOW EXPORT ALL MESSAGES AND COMMENTS
  // ============================================================

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
      const ws = getWorkspaceData(workspaceId)
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
 * Recursively collect all comment IDs (including nested replies)
 */
export async function getAllCommentIds(commentId: string): Promise<string[]> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { replies: { select: { id: true } } },
  })

  if (!comment) return [commentId]

  const ids = [commentId]

  for (const reply of comment.replies) {
    const childIds = await getAllCommentIds(reply.id)
    ids.push(...childIds)
  }

  return ids
}

/**
 * Delete local file and update workspace.json
 */
export async function deleteLocalFile(type: "message" | "comment", id: string, workspaceId: string) {
  const ws = getWorkspaceData(workspaceId)
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
  const ws = getWorkspaceData(workspaceId)
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
  const ws = getWorkspaceData(workspaceId)
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
  const ws = getWorkspaceData(workspaceId)
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
  const ws = getWorkspaceData(workspaceId)
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
