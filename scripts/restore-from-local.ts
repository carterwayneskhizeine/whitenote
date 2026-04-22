/**
 * Restore all data from local markdown files (data/link_md) into a fresh SQLite database.
 * Run: tsx scripts/restore-from-local.ts
 *
 * Prerequisites:
 * - Database must be migrated (pnpm prisma migrate dev)
 * - At least one user must be registered in the app
 * - Local data must exist in data/link_md/<workspace>/.whitenote/workspace.json
 */

import * as fs from "fs"
import * as path from "path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

const url = process.env.DATABASE_URL ?? "file:./data/whitenote.db"
const adapter = new PrismaBetterSqlite3({ url })
const prisma = new PrismaClient({ adapter })

const SYNC_DIR = path.join(process.cwd(), "data", "link_md")

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

interface WorkspaceData {
  version: number
  workspace: {
    id: string
    originalFolderName: string
    currentFolderName: string
    name: string
    lastSyncedAt: string
  }
  messages: Record<string, MessageMeta>
  comments: Record<string, CommentMeta>
}

function parseMdFile(content: string) {
  const lines = content.split(/\r?\n/)
  const firstLine = lines[0] || ""
  const body = lines.slice(1).join("\n").trimStart()
  const tags = firstLine.match(/#[\w一-龥\-\.]+/g) || []
  return {
    tags: tags.map((t) => t.substring(1)),
    content: body,
  }
}

async function upsertTags(tagNames: string[]): Promise<string[]> {
  if (tagNames.length === 0) return []
  const ids: string[] = []
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    ids.push(tag.id)
  }
  return ids
}

async function attachMessageTags(messageId: string, tagIds: string[]) {
  for (const tagId of tagIds) {
    try {
      await prisma.messageTag.create({ data: { messageId, tagId } })
    } catch {
      // ignore duplicate
    }
  }
}

async function attachCommentTags(commentId: string, tagIds: string[]) {
  for (const tagId of tagIds) {
    try {
      await prisma.commentTag.create({ data: { commentId, tagId } })
    } catch {
      // ignore duplicate
    }
  }
}

async function main() {
  // Get the first user in DB (the newly registered account)
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!user) {
    console.error("No user found in database. Please register an account first.")
    process.exit(1)
  }
  console.log(`Restoring data for user: ${user.email} (${user.id})`)

  if (!fs.existsSync(SYNC_DIR)) {
    console.error(`Sync dir not found: ${SYNC_DIR}`)
    process.exit(1)
  }

  const dirs = fs.readdirSync(SYNC_DIR, { withFileTypes: true })
  const workspaceDirs = dirs.filter((d) => d.isDirectory() && !d.name.startsWith("."))

  let totalWorkspaces = 0
  let totalMessages = 0
  let totalComments = 0
  let totalErrors = 0

  for (const wsDir of workspaceDirs) {
    const wsPath = path.join(SYNC_DIR, wsDir.name)
    const wsJsonPath = path.join(wsPath, ".whitenote", "workspace.json")

    if (!fs.existsSync(wsJsonPath)) {
      console.log(`[SKIP] ${wsDir.name}: no workspace.json`)
      continue
    }

    let ws: WorkspaceData
    try {
      ws = JSON.parse(fs.readFileSync(wsJsonPath, "utf-8"))
    } catch (e) {
      console.error(`[ERROR] Failed to parse ${wsJsonPath}:`, e)
      totalErrors++
      continue
    }

    if (ws.version !== 2) {
      console.log(`[SKIP] ${wsDir.name}: unsupported workspace version ${ws.version}`)
      continue
    }

    let workspaceId = ws.workspace.id
    const workspaceName = ws.workspace.name || wsDir.name

    // Create or skip workspace
    try {
      await prisma.workspace.upsert({
        where: { id: workspaceId },
        update: {},
        create: {
          id: workspaceId,
          name: workspaceName,
          userId: user.id,
        },
      })
      console.log(`[WS] ${workspaceName} (${workspaceId})`)
      totalWorkspaces++
    } catch (e) {
      // @@unique([userId, name]) may conflict if workspace name already exists for user
      // Try to find existing workspace by name
      const existing = await prisma.workspace.findFirst({
        where: { userId: user.id, name: workspaceName },
      })
      if (existing) {
        console.log(`[WS] ${workspaceName}: using existing workspace ${existing.id}`)
        workspaceId = existing.id
      } else {
        console.error(`[ERROR] Failed to create workspace ${workspaceName}:`, e)
        totalErrors++
        continue
      }
    }

    // Restore messages
    for (const [, msgMeta] of Object.entries(ws.messages)) {
      const mdPath = path.join(wsPath, msgMeta.currentFilename)

      if (!fs.existsSync(mdPath)) {
        // Try to find by scanning the directory
        const allFiles = fs.readdirSync(wsPath).filter((f) => f.endsWith(".md"))
        // No match found
        if (allFiles.length === 0) {
          console.log(`[SKIP MSG] ${msgMeta.id}: file not found (${msgMeta.currentFilename})`)
          continue
        }
        // Can't reliably match without the file
        console.log(`[SKIP MSG] ${msgMeta.id}: file not found (${msgMeta.currentFilename})`)
        continue
      }

      let rawContent: string
      try {
        rawContent = fs.readFileSync(mdPath, "utf-8")
      } catch (e) {
        console.error(`[ERROR] Cannot read ${mdPath}:`, e)
        totalErrors++
        continue
      }

      const { tags: tagNames, content } = parseMdFile(rawContent)

      try {
        // Check if message already exists
        const existing = await prisma.message.findUnique({ where: { id: msgMeta.id } })
        if (existing) {
          console.log(`[SKIP MSG] ${msgMeta.id}: already exists`)
          continue
        }

        await prisma.message.create({
          data: {
            id: msgMeta.id,
            content,
            authorId: user.id,
            workspaceId,
            createdAt: new Date(msgMeta.created_at),
            updatedAt: new Date(msgMeta.updated_at),
          },
        })

        // Attach tags
        if (tagNames.length > 0) {
          const tagIds = await upsertTags(tagNames)
          await attachMessageTags(msgMeta.id, tagIds)
        }

        totalMessages++
        console.log(`  [MSG] ${msgMeta.currentFilename}`)
      } catch (e) {
        console.error(`[ERROR] Message ${msgMeta.id}:`, e)
        totalErrors++
      }
    }

    // Restore comments (first pass: top-level comments where parentId is null)
    const commentEntries = Object.entries(ws.comments || {})
    const sorted = [
      ...commentEntries.filter(([, c]) => !c.parentId),
      ...commentEntries.filter(([, c]) => !!c.parentId),
    ]

    for (const [, cMeta] of sorted) {
      const mdPath = path.join(wsPath, cMeta.folderName, cMeta.currentFilename)

      if (!fs.existsSync(mdPath)) {
        console.log(`[SKIP CMT] ${cMeta.id}: file not found (${cMeta.folderName}/${cMeta.currentFilename})`)
        continue
      }

      let rawContent: string
      try {
        rawContent = fs.readFileSync(mdPath, "utf-8")
      } catch (e) {
        console.error(`[ERROR] Cannot read ${mdPath}:`, e)
        totalErrors++
        continue
      }

      const { tags: tagNames, content } = parseMdFile(rawContent)

      try {
        const existing = await prisma.comment.findUnique({ where: { id: cMeta.id } })
        if (existing) {
          console.log(`[SKIP CMT] ${cMeta.id}: already exists`)
          continue
        }

        // Verify parent message exists
        const parentMsg = await prisma.message.findUnique({ where: { id: cMeta.messageId } })
        if (!parentMsg) {
          console.log(`[SKIP CMT] ${cMeta.id}: parent message ${cMeta.messageId} not found`)
          continue
        }

        await prisma.comment.create({
          data: {
            id: cMeta.id,
            content,
            messageId: cMeta.messageId,
            parentId: cMeta.parentId || null,
            authorId: user.id,
            createdAt: new Date(cMeta.created_at),
            updatedAt: new Date(cMeta.updated_at),
          },
        })

        if (tagNames.length > 0) {
          const tagIds = await upsertTags(tagNames)
          await attachCommentTags(cMeta.id, tagIds)
        }

        totalComments++
        console.log(`  [CMT] ${cMeta.folderName}/${cMeta.currentFilename}`)
      } catch (e) {
        console.error(`[ERROR] Comment ${cMeta.id}:`, e)
        totalErrors++
      }
    }
  }

  console.log("\n========== RESTORE COMPLETE ==========")
  console.log(`Workspaces: ${totalWorkspaces}`)
  console.log(`Messages:   ${totalMessages}`)
  console.log(`Comments:   ${totalComments}`)
  console.log(`Errors:     ${totalErrors}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
