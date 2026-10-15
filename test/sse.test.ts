import { describe, it, expect } from 'vitest'
import { SseLineBuffer, parseSseDataLine } from '../src/lib/ai/sse'

/**
 * SSE 行缓冲的回归测试。
 *
 * 背景：生产日志显示 [AI Chat Stream] rag mode streamed 0 chars，
 * 且没有任何 "Failed to parse SSE line" 警告 —— 说明 data 行不是解析失败，
 * 而是根本没被识别。原实现每次 reader.read() 都直接 split("\n") 再过滤
 * "data: " 前缀，跨 read 被切开的那一行两半都不匹配前缀，于是被静默丢弃。
 *
 * 这里把同一份 SSE 报文在每一个字节位置切开，验证重组后完全等价。
 */

const CHUNKS = [
  'data: {"choices":[{"delta":{"content":"你好"}}]}\n',
  'data: {"choices":[{"delta":{"content":"，世界"}}]}\n',
  'data: {"choices":[{"delta":{}}]}\n',
  'data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}\n',
  'data: [DONE]\n',
].join('')

function collectWithBoundary(payload: string, boundary: number): string[] {
  const buf = new SseLineBuffer()
  const lines: string[] = []
  // 用 boundary 作为切分点切两块
  for (const piece of [payload.slice(0, boundary), payload.slice(boundary)]) {
    lines.push(...buf.push(piece))
  }
  lines.push(...buf.flush())
  return lines
}

describe('SseLineBuffer', () => {
  it('returns the same lines no matter where the stream is split', () => {
    const buf = new SseLineBuffer()
    const expected = buf.push(CHUNKS)

    expect(expected).toHaveLength(5)

    // 在每一个字节位置切开，结果都必须和整体解析一致
    for (let boundary = 0; boundary <= CHUNKS.length; boundary++) {
      expect(collectWithBoundary(CHUNKS, boundary)).toEqual(expected)
    }
  })

  it('never loses a line that straddles two reads', () => {
    const boundary = CHUNKS.indexOf('，世界') + 1 // 切在多字节字符中间
    const lines = collectWithBoundary(CHUNKS, boundary)

    expect(lines).toHaveLength(5)
    expect(lines.every(l => l.trim().startsWith('data: '))).toBe(true)
  })

  it('keeps an unterminated final line until flush', () => {
    const buf = new SseLineBuffer()

    expect(buf.push('data: {"a":1}')).toHaveLength(0)
    expect(buf.pending).toBe('data: {"a":1}')
    expect(buf.flush()).toEqual(['data: {"a":1}'])
    expect(buf.flush()).toEqual([])
  })

  it('handles CRLF line endings', () => {
    const buf = new SseLineBuffer()
    const lines = buf.push('data: {"a":1}\r\ndata: {"a":2}\r\n')

    expect(lines).toHaveLength(2)
    expect(parseSseDataLine(lines[0])).toBe('{"a":1}')
    expect(parseSseDataLine(lines[1])).toBe('{"a":2}')
  })

  it('survives byte-at-a-time delivery', () => {
    const buf = new SseLineBuffer()
    const collected: string[] = []

    // 逐字符喂入：最极端的分块情况
    for (const char of CHUNKS) {
      collected.push(...buf.push(char))
    }
    collected.push(...buf.flush())

    expect(collected).toHaveLength(5)
    expect(parseSseDataLine(collected[0])).toBe('{"choices":[{"delta":{"content":"你好"}}]}')
  })
})

describe('parseSseDataLine', () => {
  it('extracts the JSON payload', () => {
    expect(parseSseDataLine('data: {"a":1}')).toBe('{"a":1}')
  })

  it('ignores blank lines, comments, and the DONE sentinel', () => {
    expect(parseSseDataLine('')).toBeNull()
    expect(parseSseDataLine('   ')).toBeNull()
    expect(parseSseDataLine(': keep-alive')).toBeNull()
    expect(parseSseDataLine('data: [DONE]')).toBeNull()
    expect(parseSseDataLine('event: content')).toBeNull()
  })

  it('does not match data: without a space, which is a split line', () => {
    // 行被切开时，前半段会是 "data" 或 "data: {"，都应被安全忽略而不是误解析
    expect(parseSseDataLine('data')).toBeNull()
    expect(parseSseDataLine('{"choices":[]}')).toBeNull()
  })
})
