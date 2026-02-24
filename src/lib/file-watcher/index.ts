import * as fs from "fs"
import * as path from "path"
import { addTask } from "@/lib/queue"
import { importFromLocal, parseFilePath } from "@/lib/sync-utils"
import redis from "@/lib/redis"

// 获取文件监听目录，支持 Docker 和本地开发环境
function getWatchDir(): string {
  const envDir = process.env.FILE_WATCHER_DIR
  if (envDir) {
    return envDir
  }
  // 默认使用相对于项目根目录的路径
  return path.join(process.cwd(), "data", "link_md")
}

const WATCH_DIR = getWatchDir()
const DEBOUNCE_DELAY = 1000 // 1 second

// Folders to ignore (won't be treated as workspaces)
const IGNORED_FOLDERS = new Set([
  '.obsidian',
  '.git',
  '.DS_Store',
  '新建文件夹',
  '新建 文本文档',
  '未命名',
  'New Folder',
  'Untitled'
])

// Track processed files to avoid duplicates
const processedFiles = new Set<string>()
const processedFolders = new Set<string>()

// Track file skip counts to handle frequently-saved files
const fileSkipCounts = new Map<string, number>()
const MAX_SKIP_COUNT = 1 // Allow file to be skipped 1 time before forcing process

// Import queue for serializing file imports
const importQueue: Array<{ workspaceId: string; filePath: string }> = []
let isProcessingQueue = false

/**
 * Process import queue serially to avoid database transaction timeout
 */
async function processImportQueue() {
  if (isProcessingQueue || importQueue.length === 0) {
    return
  }

  isProcessingQueue = true

  while (importQueue.length > 0) {
    const item = importQueue.shift()
    if (item) {
      try {
        console.log(`[FileWatcher] Processing ${item.filePath}`)
        await importFromLocal(item.workspaceId, item.filePath)
        console.log(`[FileWatcher] ✓ Imported ${item.filePath}`)
      } catch (error) {
        console.error(`[FileWatcher] ✗ Error importing ${item.filePath}:`, error)
      }
    }
    // Small delay between imports to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  isProcessingQueue = false
}

/**
 * Add file to import queue
 */
function enqueueImport(workspaceId: string, filePath: string) {
  importQueue.push({ workspaceId, filePath })
  // Start processing if not already processing
  processImportQueue().catch(console.error)
}

/**
 * Check if a folder should be ignored
 */
function shouldIgnoreFolder(folderName: string): boolean {
  // Ignore hidden folders (starting with .)
  if (folderName.startsWith('.')) {
    return true
  }

  // Ignore specific folder names
  if (IGNORED_FOLDERS.has(folderName)) {
    return true
  }

  return false
}

let watchTimeout: NodeJS.Timeout | null = null
let watcher: fs.FSWatcher | null = null

export function startFileWatcher() {
  console.log(`[FileWatcher] Starting file watcher for: ${WATCH_DIR}`)

  // Ensure directory exists
  if (!fs.existsSync(WATCH_DIR)) {
    fs.mkdirSync(WATCH_DIR, { recursive: true })
  }

  // Initial scan
  scanDirectory()

  // Watch for changes
  watcher = fs.watch(WATCH_DIR, { recursive: true }, async (eventType, filename) => {
    if (!filename) return

    // Check if watcher is paused via Redis (for distributed coordination)
    const isPaused = await redis.get("file-watcher:paused")
    if (isPaused) {
      console.log(`[FileWatcher] Watcher paused, ignoring change: ${filename}`)
      return
    }

    // Debounce rapid file changes
    if (watchTimeout) {
      clearTimeout(watchTimeout)
    }

    watchTimeout = setTimeout(() => {
      console.log(`[FileWatcher] Detected change: ${filename}`)
      scanDirectory()
    }, DEBOUNCE_DELAY)
  })

  console.log(`[FileWatcher] File watcher started successfully`)
  return watcher
}

export function stopFileWatcher() {
  if (watchTimeout) {
    clearTimeout(watchTimeout)
    watchTimeout = null
  }

  if (watcher) {
    watcher.close()
    watcher = null
  }

  console.log(`[FileWatcher] File watcher stopped`)
}

function scanDirectory() {
  if (!fs.existsSync(WATCH_DIR)) {
    return
  }

  const dirs = fs.readdirSync(WATCH_DIR, { withFileTypes: true })

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue

    // Skip ignored folders
    if (shouldIgnoreFolder(dir.name)) {
      console.log(`[FileWatcher] Ignoring folder: ${dir.name}`)
      continue
    }

    const folderPath = path.join(WATCH_DIR, dir.name)
    const workspaceFile = path.join(folderPath, ".whitenote", "workspace.json")

    // Check if this is a new workspace folder (no workspace.json yet)
    if (!fs.existsSync(workspaceFile)) {
      // New workspace folder detected
      if (!processedFolders.has(folderPath)) {
        console.log(`[FileWatcher] New workspace folder detected: ${dir.name}`)
        processedFolders.add(folderPath)

        // Queue workspace creation
        addTask("create-workspace-from-folder", {
          folderName: dir.name,
          folderPath
        }).catch(console.error)
      }
    } else {
      // Existing workspace - scan for new message files
      scanWorkspaceFolder(folderPath, dir.name)
    }
  }
}

function scanWorkspaceFolder(workspacePath: string, folderName: string) {
  try {
    const items = fs.readdirSync(workspacePath, { withFileTypes: true })
    const workspaceFile = path.join(workspacePath, ".whitenote", "workspace.json")

    if (!fs.existsSync(workspaceFile)) {
      return
    }

    const ws = JSON.parse(fs.readFileSync(workspaceFile, "utf-8"))

    // Get the actual workspace ID from workspace.json
    const actualWorkspaceId = ws.workspace?.id
    if (!actualWorkspaceId) {
      console.warn(`[FileWatcher] No workspace ID found in ${folderName}`)
      return
    }

    const trackedFiles = new Map(
      Object.entries(ws.messages || {})
        .concat(Object.entries(ws.comments || {}))
        .map(([key, value]: [string, any]) => [value.currentFilename, value])
    )

    for (const item of items) {
      // Skip .whitenote folder
      if (item.isDirectory() && item.name === '.whitenote') {
        continue
      }

      // Recursively scan subdirectories (comment folders)
      if (item.isDirectory()) {
        const subDirPath = path.join(workspacePath, item.name)
        scanCommentFolder(actualWorkspaceId, subDirPath, item.name, ws)
        continue
      }

      if (!item.isFile() || !item.name.endsWith('.md')) continue

      const filePath = path.join(workspacePath, item.name)
      const stats = fs.statSync(filePath)

      // Check file size - skip very small files (likely being edited)
      if (stats.size < 5) {
        console.log(`[FileWatcher] Skipping empty file (${stats.size} bytes): ${item.name}`)
        continue
      }

      // Check file age - skip files created/modified in the last 2 seconds
      const fileAge = Date.now() - stats.mtimeMs
      const fileKey = `${actualWorkspaceId}:${item.name}`

      let shouldForceProcess = false
      if (fileAge < 2000) {
        // Increment skip count
        const currentSkipCount = fileSkipCounts.get(fileKey) || 0
        fileSkipCounts.set(fileKey, currentSkipCount + 1)

        if (currentSkipCount < MAX_SKIP_COUNT) {
          console.log(`[FileWatcher] Skipping recent file (${fileAge}ms ago, skip ${currentSkipCount + 1}/${MAX_SKIP_COUNT}): ${item.name}`)
          continue
        } else {
          console.log(`[FileWatcher] File skipped ${MAX_SKIP_COUNT} times, forcing process: ${item.name}`)
          shouldForceProcess = true
          // Don't delete skip count yet, we'll handle it after import
        }
      } else {
        // File is old enough, clear skip count
        fileSkipCounts.delete(fileKey)
      }

      // Check if file is already tracked in workspace.json
      const trackedFile = trackedFiles.get(item.name)

      if (trackedFile) {
        // File is tracked, check if it was modified
        const lastModified = stats.mtime.toISOString()

        // Always import if force processing, or if timestamps don't match
        if (shouldForceProcess || trackedFile.updated_at !== lastModified) {
          console.log(`[FileWatcher] Modified file detected: ${item.name} in workspace ${actualWorkspaceId}`)

          // Add to import queue instead of processing immediately
          enqueueImport(actualWorkspaceId, filePath)
          
          // Clear skip count after enqueuing
          fileSkipCounts.delete(fileKey)
        }
        // File not modified, skip
        continue
      }

      // New file not tracked yet
      if (processedFiles.has(fileKey)) {
        // File was processed before, but not in workspace.json
        // This might be a failed attempt, allow retry
        console.log(`[FileWatcher] Retrying previously processed file: ${item.name}`)
      }

      console.log(`[FileWatcher] New message file detected: ${item.name} in workspace ${actualWorkspaceId}`)
      processedFiles.add(fileKey)

      // Queue message creation with actual workspace ID
      addTask("create-message-from-file", {
        workspaceId: actualWorkspaceId,
        filePath,
        filename: item.name
      }).catch(console.error)
    }
  } catch (error) {
    console.error(`[FileWatcher] Error scanning workspace folder:`, error)
  }
}

function scanCommentFolder(workspaceId: string, folderPath: string, folderName: string, ws: any) {
  try {
    const files = fs.readdirSync(folderPath, { withFileTypes: true })

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue

      const filePath = path.join(folderPath, file.name)
      const stats = fs.statSync(filePath)

      // Check file size - skip very small files (likely being edited)
      if (stats.size < 5) {
        continue
      }

      // Check file age - skip files created/modified in the last 2 seconds
      const fileAge = Date.now() - stats.mtimeMs
      const fileKey = `${workspaceId}:${folderName}:${file.name}`

      let shouldForceProcess = false
      if (fileAge < 2000) {
        const currentSkipCount = fileSkipCounts.get(fileKey) || 0
        fileSkipCounts.set(fileKey, currentSkipCount + 1)

        if (currentSkipCount < MAX_SKIP_COUNT) {
          continue
        } else {
          shouldForceProcess = true
        }
      } else {
        fileSkipCounts.delete(fileKey)
      }

      // Check if file is tracked in workspace.json
      const trackedFile = Object.values(ws.comments || {}).find((c: any) =>
        c.currentFilename === file.name && c.folderName === folderName
      ) as any

      if (trackedFile) {
        // File is tracked, check if it was modified
        const lastModified = stats.mtime.toISOString()

        // Always import if force processing, or if timestamps don't match
        if (shouldForceProcess || (trackedFile.updated_at as string | undefined) !== lastModified) {
          console.log(`[FileWatcher] Modified comment file detected: ${folderName}/${file.name}`)

          // Add to import queue
          enqueueImport(workspaceId, filePath)
          
          // Clear skip count after enqueuing
          fileSkipCounts.delete(fileKey)
        }
        continue
      }

      // New comment file not tracked yet
      console.log(`[FileWatcher] New comment file detected: ${folderName}/${file.name}`)
      processedFiles.add(fileKey)

      // Import the new comment file
      importFromLocal(workspaceId, filePath).catch(error => {
        console.error(`[FileWatcher] Error importing new comment file:`, error)
      })
    }
  } catch (error) {
    console.error(`[FileWatcher] Error scanning comment folder ${folderName}:`, error)
  }
}
