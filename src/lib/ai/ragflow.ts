import { getAiConfig } from "./config"

interface RAGFlowMessage {
  role: "user" | "assistant"
  content: string
}

/**
 * 清理消息内容，移除 AI 助手提及
 * 如果清理后内容为空，返回 "test"
 */
function cleanContentForRAGFlow(content: string): string {
  // 移除所有 @goldierill 和 @GoldieRill 提及（不区分大小写）
  const cleaned = content.replace(/@goldierill/gi, "").trim()

  // 如果清理后内容为空，返回 "test"
  if (cleaned.length === 0) {
    return "test"
  }

  return cleaned
}

interface RAGFlowResponse {
  choices: Array<{
    message: {
      content: string
      reference?: {
        chunks: Record<string, {
          content: string
          document_name: string
          similarity: number
        }>
      }
    }
  }>
}

/**
 * 调用 RAGFlow OpenAI 兼容接口
 * 配置从数据库实时读取 (热更新)
 */
export async function callRAGFlow(
  userId: string,
  messages: RAGFlowMessage[]
): Promise<{ content: string; references?: Array<{ content: string; source: string }> }> {
  // 每次调用获取最新配置 (热更新核心)
  const config = await getAiConfig(userId)

  if (!config.ragflowApiKey) {
    throw new Error("RAGFlow API key not configured")
  }

  if (!config.ragflowChatId) {
    throw new Error("RAGFlow Chat ID not configured")
  }

  const response = await fetch(
    `${config.ragflowBaseUrl}/api/v1/chats_openai/${config.ragflowChatId}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.ragflowApiKey}`,
      },
      body: JSON.stringify({
        model: "model",
        messages,
        stream: false,
        extra_body: {
          reference: true,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`RAGFlow API error: ${error}`)
  }

  const data: RAGFlowResponse = await response.json()
  const message = data.choices[0]?.message

  const references = message?.reference?.chunks
    ? Object.values(message.reference.chunks).map((chunk) => ({
        content: chunk.content,
        source: chunk.document_name,
      }))
    : undefined

  return {
    content: message?.content || "",
    references,
  }
}

/**
 * 同步消息到 RAGFlow 知识库 (热更新)
 */
export async function syncToRAGFlow(userId: string, messageId: string, content: string) {
  const config = await getAiConfig(userId)

  if (!config.ragflowApiKey || !config.ragflowDatasetId) {
    console.warn("RAGFlow not configured, skipping sync")
    return
  }

  try {
    // 清理内容：移除 AI 助手提及
    const cleanedContent = cleanContentForRAGFlow(content)

    // 使用 FormData 上传文件（RAGFlow API 要求 multipart/form-data）
    const formData = new FormData()
    const blob = new Blob([cleanedContent], { type: 'text/markdown' })
    formData.append('file', blob, `message_${messageId}.md`)

    const response = await fetch(
      `${config.ragflowBaseUrl}/api/v1/datasets/${config.ragflowDatasetId}/documents`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.ragflowApiKey}`,
          // 注意：不手动设置 Content-Type，让浏览器自动设置并添加 boundary
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[RAGFlow] Failed to sync message:", messageId, "Error:", errorText)
      throw new Error(`RAGFlow sync failed: ${errorText}`)
    }

    const result = await response.json()
    console.log("[RAGFlow] Successfully synced message:", messageId, "Document:", result.data?.[0]?.id)

    // 触发文档解析（自动生成 chunks）
    if (result.data?.[0]?.id) {
      const documentId = result.data[0].id
      await fetch(
        `${config.ragflowBaseUrl}/api/v1/datasets/${config.ragflowDatasetId}/chunks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.ragflowApiKey}`,
          },
          body: JSON.stringify({
            document_ids: [documentId],
          }),
        }
      )
      console.log("[RAGFlow] Triggered parsing for document:", documentId)
    }
  } catch (error) {
    console.error("[RAGFlow] Sync error for message:", messageId, error)
    throw error
  }
}

/**
 * 从 RAGFlow 删除消息对应的文档
 * @param userId 用户 ID
 * @param messageId 消息 ID
 */
export async function deleteFromRAGFlow(userId: string, messageId: string) {
  const config = await getAiConfig(userId)

  if (!config.ragflowApiKey || !config.ragflowDatasetId) {
    console.warn("[RAGFlow] Not configured, skipping delete")
    return
  }

  try {
    const documentName = `message_${messageId}.md`

    // 1. 先查询文档 ID（通过文档名称）
    const listResponse = await fetch(
      `${config.ragflowBaseUrl}/api/v1/datasets/${config.ragflowDatasetId}/documents?name=${encodeURIComponent(documentName)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.ragflowApiKey}`,
        },
      }
    )

    if (!listResponse.ok) {
      console.error("[RAGFlow] Failed to list documents:", await listResponse.text())
      return
    }

    const listResult = await listResponse.json()

    // 检查是否找到文档
    if (!listResult.data?.docs || listResult.data.docs.length === 0) {
      console.log("[RAGFlow] Document not found, skipping delete:", documentName)
      return
    }

    // 2. 删除文档
    const documentIds = listResult.data.docs.map((doc: any) => doc.id)

    const deleteResponse = await fetch(
      `${config.ragflowBaseUrl}/api/v1/datasets/${config.ragflowDatasetId}/documents`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.ragflowApiKey}`,
        },
        body: JSON.stringify({
          ids: documentIds,
        }),
      }
    )

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()
      console.error("[RAGFlow] Failed to delete documents:", errorText)
      throw new Error(`RAGFlow delete failed: ${errorText}`)
    }

    console.log("[RAGFlow] Successfully deleted message:", messageId, "Documents:", documentIds)
  } catch (error) {
    console.error("[RAGFlow] Delete error for message:", messageId, error)
    // 不抛出错误，避免影响本地删除操作
  }
}

/**
 * 更新 RAGFlow 中的文档（先删除旧文档，再上传新文档）
 * @param userId 用户 ID
 * @param messageId 消息 ID
 * @param content 新的消息内容
 */
export async function updateRAGFlow(userId: string, messageId: string, content: string) {
  const config = await getAiConfig(userId)

  if (!config.ragflowApiKey || !config.ragflowDatasetId) {
    console.warn("[RAGFlow] Not configured, skipping update")
    return
  }

  try {
    console.log("[RAGFlow] Updating message:", messageId)

    // 1. 先删除旧文档
    await deleteFromRAGFlow(userId, messageId)

    // 2. 清理内容：移除 AI 助手提及
    const cleanedContent = cleanContentForRAGFlow(content)

    // 3. 上传新文档（复用同步逻辑）
    const formData = new FormData()
    const blob = new Blob([cleanedContent], { type: 'text/markdown' })
    formData.append('file', blob, `message_${messageId}.md`)

    const response = await fetch(
      `${config.ragflowBaseUrl}/api/v1/datasets/${config.ragflowDatasetId}/documents`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.ragflowApiKey}`,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[RAGFlow] Failed to update message:", messageId, "Error:", errorText)
      throw new Error(`RAGFlow update failed: ${errorText}`)
    }

    const result = await response.json()
    console.log("[RAGFlow] Successfully updated message:", messageId, "Document:", result.data?.[0]?.id)

    // 3. 触发文档解析（自动生成 chunks）
    if (result.data?.[0]?.id) {
      const documentId = result.data[0].id
      await fetch(
        `${config.ragflowBaseUrl}/api/v1/datasets/${config.ragflowDatasetId}/chunks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.ragflowApiKey}`,
          },
          body: JSON.stringify({
            document_ids: [documentId],
          }),
        }
      )
      console.log("[RAGFlow] Triggered parsing for updated document:", documentId)
    }
  } catch (error) {
    console.error("[RAGFlow] Update error for message:", messageId, error)
    // 不抛出错误，避免影响本地更新操作
  }
}
