import { Job } from "bullmq"
import prisma from "@/lib/prisma"
import { parseMdFile } from "@/lib/sync-utils"
import { batchUpsertTags } from "@/lib/tag-utils"
import { addTask } from "@/lib/queue"
import {
  getWorkspaceDir,
  getWorkspaceMetadataPath,
  writeWorkspaceMetadata
} from "@/lib/workspace-discovery"
import * as fs from "fs"
import * as path from "path"

interface CreateMessageFromFileJobData {
  workspaceId: string
  filePath: string
  filename: string
}

export async function processCreateMessageFromFile(
  job: Job<CreateMessageFromFileJobData>
) {
  const { workspaceId, filePath, filename } = job.data

  console.log(`[CreateMessage] Processing file: ${filename} in workspace ${workspaceId}`)

  // Wait a bit to ensure file content is fully written
  await new Promise(resolve => setTimeout(resolve, 100))

  // Read file content
  const contentRaw = fs.readFileSync(filePath, "utf-8")
  const { tags, content } = parseMdFile(contentRaw)

  if (!content || content.trim().length === 0) {
    console.log(`[CreateMessage] Empty content, skipping: ${filename}`)
    return
  }

  // Get workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: true }
  })

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  // Check if message already exists (by matching content)
  const existingMessage = await prisma.message.findFirst({
    where: {
      workspaceId,
      content,
      authorId: workspace.user.id
    }
  })

  if (existingMessage) {
    console.log(`[CreateMessage] Message already exists, updating metadata`)
    // Update workspace.json to mark as tracked
    await updateWorkspaceMetadata(workspaceId, existingMessage.id, filename, workspace.user.id)
    return existingMessage
  }

  // Create tags
  const tagIds = tags.length > 0 ? await batchUpsertTags(tags) : []

  // Create message
  const message = await prisma.message.create({
    data: {
      content,
      authorId: workspace.user.id,
      workspaceId,
      tags: tagIds.length > 0
        ? {
            create: tagIds.map((tagId) => ({ tagId }))
          }
        : undefined
    }
  })

  // Update workspace.json to track this file
  await updateWorkspaceMetadata(workspaceId, message.id, filename, workspace.user.id)

  // Trigger AI tagging if enabled
  if (workspace.enableAutoTag) {
    await addTask("auto-tag", {
      userId: workspace.user.id,
      workspaceId,
      messageId: message.id
    })
  } else {
    // Sync to RAGFlow
    await addTask("sync-ragflow", {
      userId: workspace.user.id,
      workspaceId,
      messageId: message.id,
      contentType: "message"
    })
  }

  console.log(`[CreateMessage] Created message: ${message.id}`)

  return message
}

async function updateWorkspaceMetadata(
  workspaceId: string,
  messageId: string,
  filename: string,
  userId: string
) {
  const syncUtils = await import("@/lib/sync-utils")
  const { generateFriendlyName } = syncUtils

  // Use workspace-discovery utility to find workspace directory
  const workspaceDir = getWorkspaceDir(workspaceId)
  const workspaceFile = getWorkspaceMetadataPath(workspaceId)

  if (!fs.existsSync(workspaceFile)) {
    console.warn(`[CreateMessage] workspace.json not found at ${workspaceFile}`)
    return
  }

  // Read existing workspace data
  let ws: any
  try {
    ws = JSON.parse(fs.readFileSync(workspaceFile, "utf-8"))
  } catch (error) {
    console.error(`[CreateMessage] Failed to read workspace.json:`, error)
    return
  }

  // Get message data
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { author: true, tags: { include: { tag: true } } }
  })

  if (!message) return

  const originalFilename = `message_${messageId}.md`
  const friendlyName = generateFriendlyName(message.content)
  const currentFilename = filename // Use the actual filename

  const tagString = message.tags.map((t: any) => `#${t.tag.name}`).join(" ")

  // Add/update message in workspace data
  ws.messages[originalFilename] = {
    id: messageId,
    type: "message",
    originalFilename,
    currentFilename,
    commentFolderName: originalFilename.replace('.md', ''),
    created_at: message.createdAt.toISOString(),
    updated_at: new Date().toISOString(),
    author: message.author?.email || "unknown",
    authorName: message.author?.name || "Unknown",
    tags: tagString
  }

  ws.workspace.lastSyncedAt = new Date().toISOString()

  // Write back to file using workspace-discovery utility (auto-clears cache)
  const success = writeWorkspaceMetadata(workspaceId, ws)

  if (success) {
    console.log(`[CreateMessage] Updated workspace.json with message: ${messageId} (total messages: ${Object.keys(ws.messages).length})`)
  } else {
    console.error(`[CreateMessage] Failed to write workspace.json`)
  }
}
