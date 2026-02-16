import * as fs from "fs"
import * as path from "path"

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
 * Creates necessary directories and initializes cache if needed
 */
export function writeWorkspaceMetadata(workspaceId: string, data: any): boolean {
  // First, try to get the metadata path (this will use cache if available)
  let metadataPath: string
  const meta = getWorkspaceMeta(workspaceId)

  if (meta) {
    // Workspace is in cache, use the cached path
    metadataPath = meta.metadataPath
  } else {
    // Workspace not in cache (first-time export or cache miss)
    // Use default path and ensure it's created
    metadataPath = path.join(SYNC_DIR, workspaceId, ".whitenote", "workspace.json")
    console.log(`[WorkspaceDiscovery] Workspace ${workspaceId} not in cache, using default path: ${metadataPath}`)
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

    console.log(`[WorkspaceDiscovery] Wrote workspace metadata: ${workspaceId}`)
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
