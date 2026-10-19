import { describe, it, expect } from 'vitest'
import { mergeLatestMessages } from '@/lib/message-merge'

interface Msg {
  id: string
  title: string
}

const msg = (id: string, title = id): Msg => ({ id, title })

describe('mergeLatestMessages', () => {
  it('puts new messages at the top', () => {
    // 服务端顺序：置顶优先，其次 updatedAt 倒序（新 -> 旧）
    const current = [msg('a'), msg('b')]
    const latest = [msg('n2'), msg('n1'), msg('a'), msg('b')]

    const { merged } = mergeLatestMessages(current, latest)

    expect(merged.map((m) => m.id)).toEqual(['n2', 'n1', 'a', 'b'])
  })

  it('keeps already-loaded pages that fell off the latest page', () => {
    // 用户已经向下翻到了第 3 页；最新一页里不再包含那些旧消息
    const current = [msg('a'), msg('b'), msg('c'), msg('old1'), msg('old2')]
    const latest = [msg('n1'), msg('a'), msg('b'), msg('c')]

    const { merged } = mergeLatestMessages(current, latest)

    // 关键回归点：旧分页不能因为一次「新消息」跳转而丢失
    expect(merged.map((m) => m.id)).toEqual(['n1', 'a', 'b', 'c', 'old1', 'old2'])
  })

  it('does not duplicate messages present in both', () => {
    const current = [msg('a'), msg('b')]
    const latest = [msg('a'), msg('b')]

    const { merged } = mergeLatestMessages(current, latest)

    expect(merged.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('prefers the freshest server copy of a message that is also already loaded', () => {
    const current = [msg('a', 'stale'), msg('b')]
    const latest = [msg('a', 'updated'), msg('b')]

    const { merged } = mergeLatestMessages(current, latest)

    expect(merged[0].title).toBe('updated')
  })

  it('handles an empty current list', () => {
    const { merged } = mergeLatestMessages([], [msg('a'), msg('b')])

    expect(merged.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('handles an empty latest page without dropping current messages', () => {
    const current = [msg('a'), msg('b')]

    const { merged } = mergeLatestMessages(current, [])

    expect(merged.map((m) => m.id)).toEqual(['a', 'b'])
  })
})
