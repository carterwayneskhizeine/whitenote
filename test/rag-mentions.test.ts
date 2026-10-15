import { describe, it, expect } from 'vitest'
import { stripMentions } from '../src/lib/ai/rag'

/**
 * @rag / @goldierill 提及词的剥离。
 *
 * 背景：提及词只是触发 AI 的开关，不是用户问题的一部分。
 * 之前只有索引用 sampleText 剥掉，检索查询词和回填给模型的全文都没剥，
 * 于是每次 @rag 都会拿 "@rag" 当查询词，把所有含提及的历史内容召回来。
 */
describe('stripMentions', () => {
  it('去掉 @rag 提及词', () => {
    expect(stripMentions('@rag 讲讲向量检索')).toBe('讲讲向量检索')
  })

  it('去掉 @ragflow 和 @goldierill', () => {
    expect(stripMentions('@ragflow 讲讲检索')).toBe('讲讲检索')
    expect(stripMentions('@goldierill 你好')).toBe('你好')
  })

  it('中英文混排时也能剥掉（\\b 不把 CJK 当单词字符）', () => {
    expect(stripMentions('@rag智能体怎么做的')).toBe('智能体怎么做的')
  })

  it('只剥提及词本身，不误伤单词里的 rag', () => {
    expect(stripMentions('rag 这个库和 fragment 是什么区别')).toBe(
      'rag 这个库和 fragment 是什么区别'
    )
  })

  it('剥完为空时返回空串，由调用方决定兜底文案', () => {
    expect(stripMentions('@rag')).toBe('')
  })
})
