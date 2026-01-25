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

interface WorkspaceMessage {
  id: string
  type: string
  originalFilename: string
  currentFilename: string
  commentFolderName: string
  created_at: string
  updated_at: string
  author: string
  authorName: string
  tags: string
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

  // 🔥 FIX 1: Check if this file is already tracked in workspace.json
  const workspaceFile = getWorkspaceMetadataPath(workspaceId)
  let isAlreadyTracked = false
  let existingMessageId: string | null = null

  try {
    const ws = JSON.parse(fs.readFileSync(workspaceFile, "utf-8"))
    if (ws.version === 2 && ws.messages) {
      // Check if any message has this filename as currentFilename
      for (const [key, msg] of Object.entries(ws.messages)) {
        const message = msg as WorkspaceMessage
        if (message.currentFilename === filename) {
          isAlreadyTracked = true
          existingMessageId = message.id
          console.log(`[CreateMessage] File ${filename} already tracked in workspace.json, message ID: ${message.id}`)
          break
        }
      }
    }
  } catch (error) {
    console.warn(`[CreateMessage] Failed to read workspace.json:`, error)
  }

  // 🔥 FIX 2: If already tracked, update existing message instead of creating new one
  if (isAlreadyTracked && existingMessageId) {
    const existingMessage = await prisma.message.findUnique({
      where: { id: existingMessageId },
      include: { tags: true }
    })

    if (existingMessage) {
      // Check if content actually changed
      if (existingMessage.content === content) {
        console.log(`[CreateMessage] Content unchanged, skipping update for message ${existingMessageId}`)
        return existingMessage
      }

      // Update existing message
      console.log(`[CreateMessage] Updating existing message ${existingMessageId} instead of creating new one`)
      const tagIds = tags.length > 0 ? await batchUpsertTags(tags) : []

      const updated = await prisma.message.update({
        where: { id: existingMessageId },
        data: {
          content,
          tags: {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId }))
          }
        }
      })

      // Update workspace metadata
      await updateWorkspaceMetadata(workspaceId, existingMessageId, filename, workspace.user.id)
      return updated
    }
  }

  // Check if message already exists (by matching content) - fallback method
  let existingMessage = await prisma.message.findFirst({
    where: {
      workspaceId,
      content,
      authorId: workspace.user.id
    }
  })

  // Fallback: Try matching trimmed content to handle whitespace differences
  if (!existingMessage) {
    // Fetch recent messages to check for soft match (optimization: limit to recent/all messages)
    // We fetch all messages in workspace because the file could correspond to an old message
    const candidates = await prisma.message.findMany({
      where: {
        workspaceId,
        authorId: workspace.user.id
      },
      select: { id: true, content: true, tags: true, createdAt: true, updatedAt: true, workspaceId: true, authorId: true }
    })

    const trimmedContent = content.trim()
    const match = candidates.find(m => m.content.trim() === trimmedContent)
    
    if (match) {
      console.log(`[CreateMessage] Found existing message by trimmed content match: ${match.id}`)
      // Convert partial match to full message object (though we only need id for update usually)
      existingMessage = match as any
    }
  }

  if (existingMessage) {
    console.log(`[CreateMessage] Message already exists (by content match), updating metadata`)
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
