import { registerHandler } from "./simple"
import { processAutoTag } from "./processors/auto-tag"
import { processAutoTagExtended } from "./processors/auto-tag-extended"
import { processSyncRAGFlow } from "./processors/sync-ragflow"
import { processSyncToLocal } from "./processors/sync-to-local"
import { processCreateWorkspaceFromFolder } from "./processors/create-workspace-from-folder"
import { processCreateMessageFromFile } from "./processors/create-message-from-file"

export function startWorker() {
  registerHandler("auto-tag", (data) => processAutoTag({ data } as any))
  registerHandler("auto-tag-comment", (data) => processAutoTagExtended({ data } as any))
  registerHandler("sync-ragflow", (data) => processSyncRAGFlow({ data } as any))
  registerHandler("sync-to-local", (data) => processSyncToLocal({ data } as any))
  registerHandler("create-workspace-from-folder", (data) => processCreateWorkspaceFromFolder({ data } as any))
  registerHandler("create-message-from-file", (data) => processCreateMessageFromFile({ data } as any))
  console.log("[Worker] In-process queue worker started")
}
