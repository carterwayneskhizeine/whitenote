/**
 * SSE 行缓冲解析。
 *
 * 网络分块和 SSE 的行边界无关：一次 reader.read() 可能只拿到半行，
 * 下一次才拿到剩下半行。如果每次 read 都直接 split("\n") 再过滤，
 * 被切开的那一行两半都不满足 "data: " 前缀就会被静默丢弃 ——
 * 不报错、不告警，最终表现为"模型返回了空回复"。
 *
 * 用法：
 *   const buf = new SseLineBuffer()
 *   for await (...) { for (const line of buf.push(text)) handle(line) }
 *   for (const line of buf.flush()) handle(line)
 */
export class SseLineBuffer {
  private buffer = ''

  /** 追加一段文本，返回其中已经完整（以 \n 结尾）的行 */
  push(text: string): string[] {
    this.buffer += text
    const lines = this.buffer.split('\n')
    // 最后一段可能不完整，留到下一次
    this.buffer = lines.pop() ?? ''
    return lines
  }

  /** 流结束时取出残留的最后一行（可能没有以 \n 结尾） */
  flush(): string[] {
    if (!this.buffer) return []
    const rest = this.buffer
    this.buffer = ''
    return [rest]
  }

  /** 当前还没凑成完整一行的内容 */
  get pending(): string {
    return this.buffer
  }
}

/** 去掉行尾的 \r，返回可直接 JSON.parse 的 data 部分 */
export function parseSseDataLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed === 'data: [DONE]') return null
  if (!trimmed.startsWith('data: ')) return null
  return trimmed.slice(6)
}
