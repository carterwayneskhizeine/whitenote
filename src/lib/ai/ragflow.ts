import { getAiConfig } from "./config"

interface RAGFlowMessage {
  role: "user" | "assistant"
  content: string
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
    // 使用 FormData 上传文件（RAGFlow API 要求 multipart/form-data）
    const formData = new FormData()
    const blob = new Blob([content], { type: 'text/markdown' })
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
