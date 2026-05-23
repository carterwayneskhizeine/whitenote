/**
 * Text chunker with OOM protection
 * Based on HyperBoard's chunker.js with infinite loop fix from oom-debug.md
 */

export interface Chunk {
  content: string
  index: number
}

export interface ChunkOptions {
  maxChunkSize?: number
  overlap?: number
  maxChunks?: number
}

const BOUNDARY_CHARS = '。！？\n\r；.!?'

export function chunkText(text: string, options?: ChunkOptions): Chunk[] {
  const chunkSize = options?.maxChunkSize ?? 500
  const overlap = options?.overlap ?? 50
  const maxChunks = options?.maxChunks ?? 200

  const chunks: Chunk[] = []
  let start = 0

  while (start < text.length) {
    if (chunks.length >= maxChunks) {
      console.warn(`[Chunker] Reached max chunks limit (${maxChunks}), truncating`)
      break
    }

    let end = Math.min(start + chunkSize, text.length)

    // Try to find a sentence boundary within the chunk
    if (end < text.length) {
      for (let i = end; i > start + chunkSize * 0.5; i--) {
        if (BOUNDARY_CHARS.includes(text[i])) {
          end = i + 1
          break
        }
      }
    }

    chunks.push({ content: text.slice(start, end), index: chunks.length })

    // OOM protection: must exit when reaching end of text
    if (end >= text.length) break

    // OOM protection: start must strictly advance
    const prevStart = start
    start = end - overlap
    if (start <= prevStart) break
  }

  return chunks
}
