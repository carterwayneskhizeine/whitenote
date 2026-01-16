# Markdown Sync System Technical Specification

This document details the implementation of the bidirectional sync system between WhiteNote's database and local Markdown files.

## 1. Core Logic & Utilities (`src/lib/sync-utils.ts`)

Create a new file `src/lib/sync-utils.ts` to handle all file system operations.

### Key Concepts
- **Root Directory**: `D:\Code\whitenote-data\link_md` (Configurable via env, but hardcoded for now as per request).
- **Workspace JSON**: A `.whitenote/workspace.json` file inside the root dir tracks file metadata to ensure we know which ID belongs to which file and when it was last updated.
- **Debounce/Delay**: 9-second delay on export to allow AI tagging.

### Implementation Code (`src/lib/sync-utils.ts`)

```typescript
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
function getWorkspaceData(): WorkspaceData {
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

  const contentRaw = fs.readFileSync(filePath, "utf-8")
  const { tags, content } = parseMdFile(contentRaw)

  // 1. Update DB Content
  if (meta.type === "message") {
    await prisma.message.update({
      where: { id: meta.id },
      data: { content }
    })
  } else {
    await prisma.comment.update({
      where: { id: meta.id },
      data: { content }
    })
  }
  
  // 2. Handle Tags (Simplified: We assume simple update or implementing a batch tag updater)
  // Note: You need a logic to sync tags back to DB. For now, we update content.

  // 3. Trigger RAGFlow Sync
  // Delete old docs (logic handled by RAGFlow worker usually)
  // Upload new
  await addTask("sync-ragflow", {
    userId: meta.author, // You might need user ID here, better store userId in meta or fetch from DB
    workspaceId: "default", // simplifying
    messageId: meta.id,
    contentType: meta.type
  })
}
```

## 2. Database Schema (`prisma/schema.prisma`)

Add `enableMdSync` to `AiConfig` to control the feature globally for a user.

```prisma
model AiConfig {
  // ... existing fields
  enableMdSync Boolean   @default(false)
}
```

## 3. Queue Processor (`src/lib/queue/worker.ts` or similar)

You need to process the delayed export task.

```typescript
import { exportToLocal } from "@/lib/sync-utils"

// inside worker processor
else if (job.name === "sync-to-local") {
  const { type, id } = job.data
  await exportToLocal(type, id)
}
```

## 4. API Integration (Triggering Export)

### `src/app/api/messages/route.ts` (POST)

```typescript
// ... after message creation ...

// Check if MD Sync is enabled
const aiConfig = await prisma.aiConfig.findUnique({ where: { userId: session.user.id } })

if (aiConfig?.enableMdSync) {
  await addTask("sync-to-local", {
    type: "message",
    id: message.id
  }, {
    delay: 9000 // 9 seconds delay
  })
}
```

Do the same for `api/comments`.

## 5. Socket.IO Server (The Watcher)

In `src/lib/socket/server.ts`, initialize `chokidar` to watch the file system.

```typescript
import chokidar from "chokidar"
import { importFromLocal } from "@/lib/sync-utils"

// Inside initSocketServer function, after server init

const SYNC_DIR = "D:\\Code\\whitenote-data\\link_md"

// Initialize Watcher
// ignoreInitial: true prevents syncing everything on startup, only changes
const watcher = chokidar.watch(SYNC_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles like .whitenote
  persistent: true,
  ignoreInitial: true 
})

watcher.on('change', async (path) => {
  console.log(`File ${path} has been changed`)
  const fileName = path.split('\\').pop() // Get filename
  if (fileName && fileName.endsWith('.md')) {
    await importFromLocal(fileName)
  }
})
```

## 6. Settings UI (`src/app/settings/ai/page.tsx`)

Add the toggle and manual sync buttons.

```tsx
// ... inside component
const [mdSyncEnabled, setMdSyncEnabled] = useState(false)

// Toggle Handler
const handleToggleSync = async (checked: boolean) => {
  // Call API to update AiConfig.enableMdSync
  setMdSyncEnabled(checked)
}

// Manual Sync Handlers
const handleManualExport = async () => {
    // Call API /api/sync/export-all
    toast.success("Starting full export...")
}

const handleManualImport = async () => {
    // Call API /api/sync/import-all
    toast.success("Starting full import...")
}

return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-medium">Link MD Sync</h3>
        <p className="text-sm text-gray-500">
          Automatically sync messages to D:\Code\whitenote-data\link_md
        </p>
      </div>
      <Switch 
        checked={mdSyncEnabled}
        onCheckedChange={handleToggleSync}
      />
    </div>
    
    <div className="flex gap-4">
      <Button onClick={handleManualExport}>Sync DB -> Local</Button>
      <Button onClick={handleManualImport}>Sync Local -> DB</Button>
    </div>
  </div>
)
```

## 7. Manual Sync APIs

You will need two new API endpoints or server actions for the manual buttons:

1.  **Sync DB -> Local**: Fetch ALL messages/comments, loop through them, and call `exportToLocal` (without delay).
2.  **Sync Local -> DB**: Read `workspace.json`, loop through files, call `importFromLocal`.
