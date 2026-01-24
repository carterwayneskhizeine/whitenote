import * as fs from "fs"
import * as path from "path"

const SYNC_DIR = process.env.FILE_WATCHER_DIR || "D:\\Code\\whitenote-data\\link_md"

interface WorkspaceMeta {
  id: string
  originalFolderName: string
  currentFolderName: string
  folderPath: string
  metadataPath: string
}

/**
 * Workspace Discovery Utility
 *
 * Provides centralized workspace directory lookup with caching to handle
 * manually renamed folders. All file sync operations should use this utility
 * instead of implementing their own scanning logic.
 */

// Cache for discovered workspaces
let workspaceCache: Map<string, WorkspaceMeta> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5000 // 5 seconds

/**
 * Clear the workspace cache (call after workspace operations)
 */
export function clearWorkspaceCache() {
  workspaceCache = null
  cacheTimestamp = 0
  console.log('[WorkspaceDiscovery] Cache cleared')
}

/**
 * Scan and cache all workspace metadata
 */
function scanWorkspaces(): Map<string, WorkspaceMeta> {
  const now = Date.now()

  // Return cached data if still valid
  if (workspaceCache && (now - cacheTimestamp) < CACHE_TTL) {
    return workspaceCache
  }

  const cache = new Map<string, WorkspaceMeta>()

  if (!fs.existsSync(SYNC_DIR)) {
    workspaceCache = cache
    cacheTimestamp = now
    return cache
  }

  try {
    const dirs = fs.readdirSync(SYNC_DIR, { withFileTypes: true })
    const workspaceDirs = dirs.filter(d => d.isDirectory())

    for (const dir of workspaceDirs) {
      const metadataPath = path.join(SYNC_DIR, dir.name, ".whitenote", "workspace.json")

      if (!fs.existsSync(metadataPath)) {
        continue
      }

      try {
        const data = JSON.parse(fs.readFileSync(metadataPath, "utf-8"))

        if (data.version === 2 && data.workspace?.id) {
          const meta: WorkspaceMeta = {
            id: data.workspace.id,
            originalFolderName: data.workspace.originalFolderName || dir.name,
            currentFolderName: data.workspace.currentFolderName || dir.name,
            folderPath: path.join(SYNC_DIR, dir.name),
            metadataPath
          }

          // Index by workspaceId
          cache.set(meta.id, meta)

          // Also index by folderName for reverse lookup
          cache.set(`folder:${dir.name}`, meta)
        }
      } catch (error) {
        console.warn(`[WorkspaceDiscovery] Failed to read ${metadataPath}:`, error)
      }
    }
  } catch (error) {
    console.error('[WorkspaceDiscovery] Error scanning workspaces:', error)
  }

  workspaceCache = cache
  cacheTimestamp = now

  console.log(`[WorkspaceDiscovery] Cached ${cache.size} workspaces`)

  return cache
}

/**
 * Find workspace directory path by workspaceId
 * Handles renamed folders automatically
 */
export function getWorkspaceDir(workspaceId: string): string {
  const cache = scanWorkspaces()
  const meta = cache.get(workspaceId)

  if (meta) {
    return meta.folderPath
  }

  // Fallback to default path
  return path.join(SYNC_DIR, workspaceId)
}

/**
 * Find workspace metadata by workspaceId
 */
export function getWorkspaceMeta(workspaceId: string): WorkspaceMeta | null {
  const cache = scanWorkspaces()
  return cache.get(workspaceId) || null
}

/**
 * Find workspace metadata by folder name
 * Supports both original folder names and renamed folders
 */
export function findWorkspaceByFolderName(folderName: string): WorkspaceMeta | null {
  const cache = scanWorkspaces()
  return cache.get(`folder:${folderName}`) || null
}

/**
 * Get workspace.json file path for a workspace
 */
export function getWorkspaceMetadataPath(workspaceId: string): string {
  const meta = getWorkspaceMeta(workspaceId)

  if (meta) {
    return meta.metadataPath
  }

  // Fallback
  return path.join(SYNC_DIR, workspaceId, ".whitenote", "workspace.json")
}

/**
 * Read workspace.json data with caching
 */
export function readWorkspaceMetadata(workspaceId: string): any | null {
  const metadataPath = getWorkspaceMetadataPath(workspaceId)

  if (!fs.existsSync(metadataPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(metadataPath, "utf-8"))
  } catch (error) {
    console.error(`[WorkspaceDiscovery] Failed to read workspace metadata:`, error)
    return null
  }
}

/**
 * Write workspace.json data and clear cache
 */
export function writeWorkspaceMetadata(workspaceId: string, data: any): boolean {
  const metadataPath = getWorkspaceMetadataPath(workspaceId)
  const meta = getWorkspaceMeta(workspaceId)

  if (!meta) {
    console.warn(`[WorkspaceDiscovery] Workspace ${workspaceId} not found, cannot write metadata`)
    return false
  }

  try {
    // Ensure directory exists
    const metaDir = path.dirname(metadataPath)
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true })
    }

    fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2))

    // Clear cache to ensure fresh reads
    clearWorkspaceCache()

    console.log(`[WorkspaceDiscovery] Updated workspace metadata: ${workspaceId}`)
    return true
  } catch (error) {
    console.error(`[WorkspaceDiscovery] Failed to write workspace metadata:`, error)
    return false
  }
}

/**
 * Get workspaceId from folder name
 * Reverse lookup helper
 */
export function getWorkspaceIdByFolderName(folderName: string): string | null {
  const meta = findWorkspaceByFolderName(folderName)
  return meta?.id || null
}

/**
 * Get folder name from workspaceId
 */
export function getFolderNameByWorkspaceId(workspaceId: string): string | null {
  const meta = getWorkspaceMeta(workspaceId)
  return meta?.currentFolderName || null
}
