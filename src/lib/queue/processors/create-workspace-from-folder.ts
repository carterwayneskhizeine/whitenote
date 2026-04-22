import type { Job } from "@/lib/queue/types"
import prisma from "@/lib/prisma"
import { provisionRAGFlowForWorkspace } from "@/lib/ragflow/provision"
import { getAiConfig } from "@/lib/ai/config"
import * as fs from "fs"
import * as path from "path"

interface CreateWorkspaceFromFolderJobData {
  folderName: string
  folderPath: string
}

export async function processCreateWorkspaceFromFolder(
  job: Job<CreateWorkspaceFromFolderJobData>
) {
  const { folderName, folderPath } = job.data

  console.log(`[CreateWorkspace] Processing folder: ${folderName}`)

  // Get the first user (or use a config setting for default user)
  const user = await prisma.user.findFirst({
    where: { email: process.env.DEFAULT_USER_EMAIL || "user@example.com" }
  })

  if (!user) {
    throw new Error("No user found to create workspace. Please set DEFAULT_USER_EMAIL in .env")
  }

  // Check if workspace already exists
  const existingWorkspace = await prisma.workspace.findFirst({
    where: {
      userId: user.id,
      name: folderName
    }
  })

  if (existingWorkspace) {
    console.log(`[CreateWorkspace] Workspace already exists: ${folderName}`)
    // Still create workspace.json if it doesn't exist
    const metaDir = path.join(folderPath, ".whitenote")
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true })
      const workspaceFile = path.join(metaDir, "workspace.json")
      if (!fs.existsSync(workspaceFile)) {
        const workspaceData = {
          version: 2,
          workspace: {
            id: existingWorkspace.id,
            originalFolderName: folderName,
            currentFolderName: folderName,
            name: folderName,
            lastSyncedAt: new Date().toISOString()
          },
          messages: {},
          comments: {}
        }
        fs.writeFileSync(workspaceFile, JSON.stringify(workspaceData, null, 2))
      }
    }
    return existingWorkspace
  }

  // Get RAGFlow config
  const config = await getAiConfig(user.id)

  if (!config.ragflowBaseUrl || !config.ragflowApiKey) {
    console.warn(`[CreateWorkspace] RAGFlow not configured for user ${user.email}, creating workspace without RAGFlow`)
    // Create workspace without RAGFlow
    const workspace = await prisma.workspace.create({
      data: {
        name: folderName,
        userId: user.id,
        isDefault: false
      }
    })

    // Create workspace.json metadata file
    const metaDir = path.join(folderPath, ".whitenote")
    fs.mkdirSync(metaDir, { recursive: true })

    const workspaceData = {
      version: 2,
      workspace: {
        id: workspace.id,
        originalFolderName: folderName,
        currentFolderName: folderName,
        name: folderName,
        lastSyncedAt: new Date().toISOString()
      },
      messages: {},
      comments: {}
    }

    fs.writeFileSync(
      path.join(metaDir, "workspace.json"),
      JSON.stringify(workspaceData, null, 2)
    )

    console.log(`[CreateWorkspace] Created workspace (without RAGFlow): ${workspace.id} (${folderName})`)
    return workspace
  }

  // Create RAGFlow resources
  let datasetId: string | null = null
  let chatId: string | null = null

  try {
    const result = await provisionRAGFlowForWorkspace(
      config.ragflowBaseUrl,
      config.ragflowApiKey,
      folderName,
      user.id
    )
    datasetId = result.datasetId
    chatId = result.chatId
  } catch (error) {
    console.error(`[CreateWorkspace] Error provisioning RAGFlow:`, error)
    throw new Error(`Failed to provision RAGFlow: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: folderName,
      userId: user.id,
      ragflowDatasetId: datasetId,
      ragflowChatId: chatId,
      isDefault: false
    }
  })

  // Create workspace.json metadata file
  const metaDir = path.join(folderPath, ".whitenote")
  fs.mkdirSync(metaDir, { recursive: true })

  const workspaceData = {
    version: 2,
    workspace: {
      id: workspace.id,
      originalFolderName: folderName,
      currentFolderName: folderName,
      name: folderName,
      lastSyncedAt: new Date().toISOString()
    },
    messages: {},
    comments: {}
  }

  fs.writeFileSync(
    path.join(metaDir, "workspace.json"),
    JSON.stringify(workspaceData, null, 2)
  )

  console.log(`[CreateWorkspace] Created workspace: ${workspace.id} (${folderName})`)

  return workspace
}
