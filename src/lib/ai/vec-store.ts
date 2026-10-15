/**
 * sqlite-vec vector store
 * Uses better-sqlite3 with sqlite-vec extension on the same SQLite DB file.
 * Each workspace gets its own pair of tables: vec_chunks_{id} + vec_meta_{id}
 */

import BetterSqlite3 from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import path from 'path'

type Database = BetterSqlite3.Database

export interface VecSearchResult {
  rowid: number
  distance: number
  contentId: string
  contentType: string
  chunkIndex: number
  content: string
}

let vecDb: Database | null = null

function getVecDb(): Database {
  if (vecDb) return vecDb

  const dbPath = path.join(process.cwd(), 'data', 'whitenote.db')
  vecDb = new BetterSqlite3(dbPath, { readonly: false })
  vecDb.pragma('journal_mode = WAL')
  sqliteVec.load(vecDb)

  // Shared rowid sequence for all vec tables
  vecDb.exec(`
    CREATE TABLE IF NOT EXISTS vec_rowid_seq (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `)

  return vecDb
}

function safeId(workspaceId: string): string {
  return workspaceId.replace(/-/g, '_')
}

function chunksTable(workspaceId: string): string {
  return `vec_chunks_${safeId(workspaceId)}`
}

function metaTable(workspaceId: string): string {
  return `vec_meta_${safeId(workspaceId)}`
}

/**
 * 记录每个 workspace 的向量表维度。
 * vec0 虚拟表的维度写死在 schema 里，建表后无法 ALTER，
 * 因此模型换了维度只能 drop 重建并重新索引。
 */
function dimsTable(): string {
  return 'vec_workspace_dims'
}

export function ensureVecTable(workspaceId: string, dimension: number): void {
  const db = getVecDb()
  const ct = chunksTable(workspaceId)
  const mt = metaTable(workspaceId)
  const dt = dimsTable()

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${dt} (
      workspace_id TEXT PRIMARY KEY,
      dimension INTEGER NOT NULL
    )
  `)

  const recorded = db.prepare(`SELECT dimension FROM ${dt} WHERE workspace_id = ?`).get(workspaceId) as
    | { dimension: number }
    | undefined

  const chunksTableExists = !!db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(ct)

  // 维度对不上时旧向量无法再被检索到，只能重建两张表后重新索引。
  // 没有维度记录但已有 chunks 表 = 旧版本建的表（当时维度是写死的），
  // 同样无法确认它是否匹配，按重建处理。
  const shouldRebuild = chunksTableExists && (!recorded || recorded.dimension !== dimension)

  if (shouldRebuild) {
    console.warn(
      `[RAG] Rebuilding vector tables for workspace ${workspaceId}: ` +
      `${recorded ? `${recorded.dimension} -> ` : ''}${dimension} dimensions. ` +
      `Existing chunks must be re-indexed.`
    )
    db.exec(`DROP TABLE IF EXISTS ${ct}`)
    db.exec(`DROP TABLE IF EXISTS ${mt}`)
  }

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${ct} USING vec0(embedding float[${dimension}])
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${mt} (
      rowid INTEGER PRIMARY KEY,
      content_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${mt}_content_id ON ${mt}(content_id)`)

  db.prepare(`
    INSERT INTO ${dt} (workspace_id, dimension) VALUES (?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET dimension = excluded.dimension
  `).run(workspaceId, dimension)
}

export function storeChunks(
  workspaceId: string,
  contentId: string,
  contentType: 'message' | 'comment',
  chunks: Array<{ content: string; index: number }>,
  embeddings: Float32Array[],
): void {
  const db = getVecDb()
  const ct = chunksTable(workspaceId)
  const mt = metaTable(workspaceId)

  // Delete existing chunks for this content
  deleteChunks(workspaceId, contentId)

  const insertVec = db.prepare(`INSERT INTO ${ct}(rowid, embedding) VALUES (?, ?)`)
  const insertMeta = db.prepare(`INSERT INTO ${mt}(rowid, content_id, content_type, chunk_index, content) VALUES (?, ?, ?, ?, ?)`)
  const nextId = db.prepare('INSERT INTO vec_rowid_seq DEFAULT VALUES RETURNING id')

  const transaction = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const row = nextId.get() as { id: number }
      const rowid = BigInt(row.id)

      insertVec.run(rowid, embeddings[i])
      insertMeta.run(row.id, contentId, contentType, chunks[i].index, chunks[i].content)
    }
  })

  transaction()
}

export function deleteChunks(workspaceId: string, contentId: string): void {
  const db = getVecDb()
  const ct = chunksTable(workspaceId)
  const mt = metaTable(workspaceId)

  // Get rowids to delete from vec table
  const rows = db.prepare(`SELECT rowid FROM ${mt} WHERE content_id = ?`).all(contentId) as Array<{ rowid: number }>

  if (rows.length > 0) {
    const deleteVec = db.prepare(`DELETE FROM ${ct} WHERE rowid = ?`)
    const deleteMeta = db.prepare(`DELETE FROM ${mt} WHERE content_id = ?`)

    db.transaction(() => {
      for (const row of rows) {
        deleteVec.run(BigInt(row.rowid))
      }
      deleteMeta.run(contentId)
    })()
  }
}

export function searchChunks(
  workspaceId: string,
  queryEmbedding: Float32Array,
  topK: number = 5,
): VecSearchResult[] {
  const db = getVecDb()
  const ct = chunksTable(workspaceId)
  const mt = metaTable(workspaceId)

  // sqlite-vec 的 KNN 查询必须带 "k = ?" 约束（等价于 LIMIT k）。
  // 写成 "ORDER BY distance LIMIT ?" 不行：绑定参数在 prepare 阶段取不到值，
  // sqlite-vec 识别不出 KNN 约束，会直接报
  // "A LIMIT or 'k = ?' constraint is required on vec0 knn queries."。
  const results = db.prepare(`
    SELECT v.rowid, v.distance, m.content_id, m.content_type, m.chunk_index, m.content
    FROM ${ct} v
    JOIN ${mt} m ON v.rowid = m.rowid
    WHERE v.embedding MATCH ? AND k = ?
    ORDER BY v.distance
  `).all(queryEmbedding, topK) as Array<{
    rowid: number
    distance: number
    content_id: string
    content_type: string
    chunk_index: number
    content: string
  }>

  return results.map(r => ({
    rowid: r.rowid,
    distance: r.distance,
    contentId: r.content_id,
    contentType: r.content_type,
    chunkIndex: r.chunk_index,
    content: r.content,
  }))
}

export function getChunkCount(workspaceId: string): number {
  const db = getVecDb()
  const mt = metaTable(workspaceId)
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${mt}`).get() as { count: number }
    return result.count
  } catch {
    return 0
  }
}
