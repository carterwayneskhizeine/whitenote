/**
 * Embedding generation via OpenAI-compatible API (SiliconFlow, etc.)
 */

export interface EmbeddingConfig {
  baseUrl: string
  apiKey: string
  model: string
}

const MAX_TEXT_LENGTH = 2000
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024 // 2MB
const BATCH_SIZE = 8
const MAX_RETRIES = 3

export async function getEmbedding(text: string, config: EmbeddingConfig): Promise<Float32Array> {
  const truncated = text.slice(0, MAX_TEXT_LENGTH)
  const results = await callEmbeddingApi([truncated], config)
  return results[0]
}

export async function getEmbeddings(texts: string[], config: EmbeddingConfig): Promise<Float32Array[]> {
  const truncated = texts.map(t => t.slice(0, MAX_TEXT_LENGTH))
  const allEmbeddings: Float32Array[] = []

  for (let i = 0; i < truncated.length; i += BATCH_SIZE) {
    const batch = truncated.slice(i, i + BATCH_SIZE)
    const batchResults = await callEmbeddingApi(batch, config)
    allEmbeddings.push(...batchResults)
  }

  return allEmbeddings
}

async function callEmbeddingApi(texts: string[], config: EmbeddingConfig): Promise<Float32Array[]> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/embeddings`

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Embedding API error ${response.status}: ${body.slice(0, 200)}`)
      }

      const json = await response.json()

      // Sort by index to ensure order matches input
      const data = json.data as Array<{ embedding: number[]; index: number }>
      data.sort((a, b) => a.index - b.index)

      return data.map(d => new Float32Array(d.embedding))
    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * 1000
        console.warn(`[Embedding] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error instanceof Error ? error.message : error)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw error
      }
    }
  }

  throw new Error('Embedding API failed after all retries')
}
