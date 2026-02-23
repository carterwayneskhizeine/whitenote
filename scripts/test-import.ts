import prisma from "@/lib/prisma"
import * as path from "path"
import * as fs from "fs"
import { parseMdFile, sanitizeFolderName } from "@/lib/sync-utils"

async function testImport() {
  try {
    const workspaceId = "cmlyx5uzz0007goimrxb3ea6j"
    const filePath = "d:/Code/whitenote/data/link_md/Electron/npx-electron-builder.md"

    console.log("Testing import...")

    // Read file
    const contentRaw = fs.readFileSync(filePath, "utf-8")
    const { tags, content } = parseMdFile(contentRaw)

    console.log("Tags:", tags)
    console.log("Content length:", content.length)

    // Update database
    const message = await prisma.message.findUnique({
      where: { id: "cmlyx69lh0008goim2zxm53bq" },
      include: { tags: true }
    })

    if (!message) {
      console.log("Message not found")
      await prisma.$disconnect()
      process.exit(1)
    }

    console.log("Current content length:", message.content.length)

    // Update message
    await prisma.message.update({
      where: { id: "cmlyx69lh0008goim2zxm53bq" },
      data: { content }
    })

    console.log("✓ Message updated successfully")

    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error("Error:", error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

testImport()
