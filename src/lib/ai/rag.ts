/**
 * RAG Router — unified interface for sqlite-vec (primary) and RAGFlow (fallback)
 */

import prisma from '@/lib/prisma'
import { getAiConfig } from '@/lib/ai/config'
import { chunkText } from '@/lib/ai/chunker'
import { getEmbedding, getEmbeddings, type EmbeddingConfig } from '@/lib/ai/embedding'
import { ensureVecTable, storeChunks, deleteChunks, searchChunks } from '@/lib/ai/vec-store'
import { syncToRAGFlowWithDatasetId } from '@/lib/ai/ragflow'

export interface RAGSearchResult {
  content: string
  sourceId: string
  sourceType: 'message' | 'comment'
  score: number
}

const EMBEDDING_DIMENSION = 1024 // bge-m3 dimension

function getEmbeddingConfig(config: any): EmbeddingConfig | null {
  if (!config.embeddingApiKey) return null
  return {
    baseUrl: config.embeddingBaseUrl || 'https://api.siliconflow.cn/v1',
    apiKey: config.embeddingApiKey,
    model: config.embeddingModel || 'Qwen/Qwen3-Embedding-4B',
  }
}

function stripMentions(text: string): string {
  return text.replace(/@goldierill|@ragflow|@rag\b/gi, '').trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function sampleText(text: string, maxLength = 2000): string {
  const cleaned = stripMentions(stripHtml(text))
  if (cleaned.length <= maxLength) return cleaned
  const half = maxLength / 2
  return cleaned.slice(0, half) + '\n...\n' + cleaned.slice(-half)
}

// --- Public API ---

export async function syncToRAG(
  userId: string,
  workspaceId: string,
  contentId: string,
  contentType: 'message' | 'comment',
  content: string,
  medias?: Array<{ id: string; url: string; type: string }>,
): Promise<void> {
  const config = await getAiConfig(userId)
  const embConfig = getEmbeddingConfig(config)

  if (embConfig) {
    // sqlite-vec path (primary)
    await syncToSqliteVec(workspaceId, contentId, contentType, content, embConfig)
  } else {
    // RAGFlow fallback
    await syncToRAGFlowFallback(userId, workspaceId, contentId, contentType, content, medias, config)
  }
}

async function syncToSqliteVec(
  workspaceId: string,
  contentId: string,
  contentType: 'message' | 'comment',
  content: string,
  embConfig: EmbeddingConfig,
): Promise<void> {
  const sampled = sampleText(content)
  if (!sampled) {
    console.log(`[RAG] Skipping empty content: ${contentId}`)
    return
  }

  const chunks = chunkText(sampled)
  if (chunks.length === 0) return

  const texts = chunks.map(c => c.content)
  const embeddings = await getEmbeddings(texts, embConfig)

  ensureVecTable(workspaceId, EMBEDDING_DIMENSION)
  storeChunks(workspaceId, contentId, contentType, chunks, embeddings)

  console.log(`[RAG] Indexed ${contentType} ${contentId}: ${chunks.length} chunks`)
}

async function syncToRAGFlowFallback(
  userId: string,
  workspaceId: string,
  contentId: string,
  contentType: 'message' | 'comment',
  content: string,
  medias?: Array<{ id: string; url: string; type: string }>,
  config?: any,
): Promise<void> {
  if (!config) config = await getAiConfig(userId)

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ragflowDatasetId: true },
  })

  if (!workspace?.ragflowDatasetId || !config.ragflowBaseUrl || !config.ragflowApiKey) {
    console.warn(`[RAG] No available backend for ${contentType} ${contentId}`)
    return
  }

  await syncToRAGFlowWithDatasetId(
    config.ragflowBaseUrl,
    config.ragflowApiKey,
    workspace.ragflowDatasetId,
    contentId,
    content,
    medias || [],
  )

  console.log(`[RAG] Synced ${contentType} ${contentId} to RAGFlow`)
}

export async function deleteFromRAG(
  userId: string,
  workspaceId: string,
  contentId: string,
  contentType: 'message' | 'comment',
): Promise<void> {
  const config = await getAiConfig(userId)
  const embConfig = getEmbeddingConfig(config)

  if (embConfig) {
    try {
      deleteChunks(workspaceId, contentId)
      console.log(`[RAG] Deleted ${contentType} ${contentId} from sqlite-vec`)
    } catch (error) {
      console.error(`[RAG] Failed to delete from sqlite-vec:`, error)
    }
  }

  // Also try RAGFlow deletion if configured
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ragflowDatasetId: true },
  })
  if (workspace?.ragflowDatasetId && config.ragflowApiKey) {
    try {
      const { deleteFromRAGFlow } = await import('@/lib/ai/ragflow')
      await deleteFromRAGFlow(
        userId,
        workspace.ragflowDatasetId,
        contentId,
        contentType,
      )
    } catch (error) {
      console.error(`[RAG] Failed to delete from RAGFlow:`, error)
    }
  }
}

export async function searchRAG(
  userId: string,
  workspaceId: string,
  query: string,
  options?: { mode?: 'keyword' | 'semantic' | 'hybrid'; limit?: number },
): Promise<RAGSearchResult[]> {
  const config = await getAiConfig(userId)
  const embConfig = getEmbeddingConfig(config)
  const limit = options?.limit ?? 5

  if (embConfig) {
    return searchSqliteVec(workspaceId, query, embConfig, limit)
  }

  // RAGFlow fallback: not implemented for search (would need different API)
  console.warn('[RAG] Search requires embedding config (sqlite-vec)')
  return []
}

async function searchSqliteVec(
  workspaceId: string,
  query: string,
  embConfig: EmbeddingConfig,
  topK: number,
): Promise<RAGSearchResult[]> {
  ensureVecTable(workspaceId, EMBEDDING_DIMENSION)

  const queryEmbedding = await getEmbedding(query, embConfig)
  const results = searchChunks(workspaceId, queryEmbedding, topK)

  // Deduplicate by contentId, keep highest score
  const seen = new Map<string, RAGSearchResult>()
  for (const r of results) {
    const existing = seen.get(r.contentId)
    const score = 1 - r.distance // convert distance to similarity
    if (!existing || score > existing.score) {
      seen.set(r.contentId, {
        content: r.content,
        sourceId: r.contentId,
        sourceType: r.contentType as 'message' | 'comment',
        score,
      })
    }
  }

  // Fetch full content from DB for the top results
  const searchResults = Array.from(seen.values())
  await enrichWithFullContent(searchResults)

  return searchResults
}

async function enrichWithFullContent(results: RAGSearchResult[]): Promise<void> {
  for (const result of results) {
    try {
      if (result.sourceType === 'message') {
        const msg = await prisma.message.findUnique({
          where: { id: result.sourceId },
          select: { content: true },
        })
        if (msg) result.content = stripHtml(msg.content)
      } else {
        const cmt = await prisma.comment.findUnique({
          where: { id: result.sourceId },
          select: { content: true },
        })
        if (cmt) result.content = stripHtml(cmt.content)
      }
    } catch {
      // Keep chunk content as fallback
    }
  }
}

export async function reindexWorkspace(
  userId: string,
  workspaceId: string,
): Promise<{ messagesSynced: number; commentsSynced: number }> {
  const config = await getAiConfig(userId)
  const embConfig = getEmbeddingConfig(config)
  if (!embConfig) throw new Error('Embedding API key not configured')

  let messagesSynced = 0
  let commentsSynced = 0

  // Index messages
  const messages = await prisma.message.findMany({
    where: { workspaceId },
    select: { id: true, content: true },
  })

  for (const msg of messages) {
    try {
      await syncToSqliteVec(workspaceId, msg.id, 'message', msg.content, embConfig)
      messagesSynced++
      await new Promise(r => setTimeout(r, 2000)) // Rate limit
    } catch (error) {
      console.error(`[RAG] Reindex failed for message ${msg.id}:`, error)
    }
  }

  // Index comments (exclude AI bot comments)
  const comments = await prisma.comment.findMany({
    where: {
      message: { workspaceId },
      isAIBot: false,
    },
    select: { id: true, content: true },
  })

  for (const cmt of comments) {
    try {
      await syncToSqliteVec(workspaceId, cmt.id, 'comment', cmt.content, embConfig)
      commentsSynced++
      await new Promise(r => setTimeout(r, 2000)) // Rate limit
    } catch (error) {
      console.error(`[RAG] Reindex failed for comment ${cmt.id}:`, error)
    }
  }

  console.log(`[RAG] Reindex complete: ${messagesSynced} messages, ${commentsSynced} comments`)
  return { messagesSynced, commentsSynced }
}
