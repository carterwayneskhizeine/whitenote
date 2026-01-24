import * as fs from "fs"
import * as path from "path"
import { addTask } from "@/lib/queue"

const WATCH_DIR = process.env.FILE_WATCHER_DIR || "D:\\Code\\whitenote-data\\link_md"
const DEBOUNCE_DELAY = 1000 // 1 second

// Folders to ignore (won't be treated as workspaces)
const IGNORED_FOLDERS = new Set([
  '.obsidian',
  '.git',
  '.DS_Store',
  '新建文件夹',
  '未命名',
  'New Folder',
  'Untitled'
])

// Track processed files to avoid duplicates
const processedFiles = new Set<string>()
const processedFolders = new Set<string>()

// Track file skip counts to handle frequently-saved files
const fileSkipCounts = new Map<string, number>()
const MAX_SKIP_COUNT = 3 // Allow file to be skipped 3 times before forcing process

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
  watcher = fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return

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
    const files = fs.readdirSync(workspacePath, { withFileTypes: true })
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

    const trackedFiles = new Set(
      Object.values(ws.messages || {})
        .map((m: any) => m.currentFilename)
        .concat(Object.values(ws.comments || {}).map((c: any) => c.currentFilename))
    )

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue

      const filePath = path.join(workspacePath, file.name)

      // Skip if already tracked in workspace.json (file was processed before)
      if (trackedFiles.has(file.name)) {
        continue
      }

      // Check if file is in processedFiles
      const fileKey = `${actualWorkspaceId}:${file.name}`
      if (processedFiles.has(fileKey)) {
        // File was processed before, but not in workspace.json
        // This might be a failed attempt, allow retry
        console.log(`[FileWatcher] Retrying previously processed file: ${file.name}`)
      }

      // Check file size - skip very small files (likely being edited)
      const stats = fs.statSync(filePath)
      if (stats.size < 5) {
        console.log(`[FileWatcher] Skipping empty file (0 bytes): ${file.name}`)
        continue
      }

      // Check file age - skip files created/modified in the last 2 seconds
      const fileAge = Date.now() - stats.mtimeMs
      if (fileAge < 2000) {
        // Increment skip count
        const currentSkipCount = fileSkipCounts.get(fileKey) || 0
        fileSkipCounts.set(fileKey, currentSkipCount + 1)

        if (currentSkipCount < MAX_SKIP_COUNT) {
          console.log(`[FileWatcher] Skipping recent file (${fileAge}ms ago, skip ${currentSkipCount + 1}/${MAX_SKIP_COUNT}): ${file.name}`)
          // Don't mark as processed, will retry on next scan
          continue
        } else {
          console.log(`[FileWatcher] File skipped ${MAX_SKIP_COUNT} times, forcing process: ${file.name}`)
          // Clear skip count and proceed to process
          fileSkipCounts.delete(fileKey)
        }
      } else {
        // File is old enough, clear skip count
        fileSkipCounts.delete(fileKey)
      }

      console.log(`[FileWatcher] New message file detected: ${file.name} in workspace ${actualWorkspaceId}`)
      processedFiles.add(fileKey)

      // Queue message creation with actual workspace ID
      addTask("create-message-from-file", {
        workspaceId: actualWorkspaceId,
        filePath,
        filename: file.name
      }).catch(console.error)
    }
  } catch (error) {
    console.error(`[FileWatcher] Error scanning workspace folder:`, error)
  }
}
