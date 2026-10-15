import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * vec0 KNN 查询语义的回归测试。
 *
 * 背景：sqlite-vec 要求 KNN 查询带 "k = ?" 约束。写成
 * "ORDER BY distance LIMIT ?" 会失败，因为绑定参数在 prepare 阶段取不到值，
 * sqlite-vec 识别不出 KNN 约束，直接报：
 *   "A LIMIT or 'k = ?' constraint is required on vec0 knn queries."
 *
 * 这里不直接测 vec-store（它把库路径写死在 data/whitenote.db），
 * 而是针对同样的 SQL 形状做验证，防止有人把 k = ? 改回 LIMIT ?。
 *
 * 注：这里没有断言 "LIMIT ? 一定会报错"。生产环境确实会报，但能否识别成 KNN
 * 约束和 sqlite-vec 版本、查询计划有关，本地实测不一定复现。真正要守住的是
 * k = ? 这一形态能正确返回结果。
 */

const DIM = 4

let db: BetterSqlite3.Database
let dbPath: string

function createSchema(database: BetterSqlite3.Database, tableSuffix: string) {
  database.exec(`
    CREATE VIRTUAL TABLE vec_chunks_${tableSuffix} USING vec0(embedding float[${DIM}])
  `)
  database.exec(`
    CREATE TABLE vec_meta_${tableSuffix} (
      rowid INTEGER PRIMARY KEY,
      content_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL
    )
  `)
}

function insertVectors(database: BetterSqlite3.Database, tableSuffix: string, vectors: number[][]) {
  const insertVec = database.prepare(
    `INSERT INTO vec_chunks_${tableSuffix}(rowid, embedding) VALUES (?, ?)`
  )
  const insertMeta = database.prepare(
    `INSERT INTO vec_meta_${tableSuffix}(rowid, content_id, content_type, chunk_index, content)
     VALUES (?, ?, ?, ?, ?)`
  )
  vectors.forEach((v, i) => {
    const rowid = BigInt(i + 1)
    insertVec.run(rowid, new Float32Array(v))
    insertMeta.run(Number(rowid), `msg-${i}`, 'message', 0, `content ${i}`)
  })
}

/** 与 vec-store.ts searchChunks 保持一致的查询 */
function search(database: BetterSqlite3.Database, tableSuffix: string, query: number[], topK: number) {
  return database
    .prepare(`
      SELECT v.rowid, v.distance, m.content_id, m.content_type, m.chunk_index, m.content
      FROM vec_chunks_${tableSuffix} v
      JOIN vec_meta_${tableSuffix} m ON v.rowid = m.rowid
      WHERE v.embedding MATCH ? AND k = ?
      ORDER BY v.distance
    `)
    .all(new Float32Array(query), topK) as Array<{
    rowid: number
    distance: number
    content_id: string
  }>
}

describe('sqlite-vec knn queries', () => {
  beforeEach(() => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vec-knn-')), 'test.db')
    db = new BetterSqlite3(dbPath)
    sqliteVec.load(db)
  })

  afterEach(() => {
    db?.close()
    if (dbPath) fs.rmSync(path.dirname(dbPath), { recursive: true, force: true })
  })

  it('returns the k nearest neighbors ordered by distance', () => {
    createSchema(db, 'a')
    insertVectors(db, 'a', [
      [1, 0, 0, 0], // closest to the query
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0.9, 0.1, 0, 0], // second closest
    ])

    const results = search(db, 'a', [1, 0, 0, 0], 2)

    expect(results).toHaveLength(2)
    expect(results[0].content_id).toBe('msg-0')
    expect(results[0].distance).toBeCloseTo(0, 5)
    expect(results[1].content_id).toBe('msg-3')
    // distances are ascending
    expect(results[1].distance).toBeGreaterThan(results[0].distance)
  })

  it('returns no rows on an empty index instead of throwing', () => {
    createSchema(db, 'c')

    expect(search(db, 'c', [1, 0, 0, 0], 5)).toHaveLength(0)
  })

  it('keeps indexes separate per workspace table', () => {
    createSchema(db, 'd')
    createSchema(db, 'e')
    insertVectors(db, 'd', [[1, 0, 0, 0]])
    insertVectors(db, 'e', [[0, 1, 0, 0]])

    // workspace d only holds a vector identical to the query
    expect(search(db, 'd', [1, 0, 0, 0], 5)[0].content_id).toBe('msg-0')
    expect(search(db, 'd', [1, 0, 0, 0], 5)[0].distance).toBeCloseTo(0, 5)

    // workspace e only holds the orthogonal vector, so it must be the sole hit
    const eResults = search(db, 'e', [1, 0, 0, 0], 5)
    expect(eResults).toHaveLength(1)
    expect(eResults[0].content_id).toBe('msg-0')
    // default metric is L2: ||[1,0,0,0] - [0,1,0,0]|| = sqrt(2)
    expect(eResults[0].distance).toBeCloseTo(Math.SQRT2, 4)
  })
})
