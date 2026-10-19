import { describe, it, expect } from 'vitest'
import { resolveNewMessageJump } from '@/lib/new-message-target'

describe('resolveNewMessageJump', () => {
  // socket 是按 user 房间广播的（不分 workspace），而信息流是按当前 workspace 分页的。
  // 所以新消息常常根本不在当前 workspace 的第一页里 —— 这时必须跳详情页，
  // 而不是滚到当前信息流顶部（那正是用户看到的「点了没反应」）。

  it('navigates to the status page when the new message is in another workspace', () => {
    const target = resolveNewMessageJump({
      pendingIds: ['cm_other_ws'],
      latestPageIds: ['a', 'b', 'c'],
      renderedIds: new Set(['a', 'b', 'c']),
    })

    expect(target).toEqual({ kind: 'navigate', messageId: 'cm_other_ws' })
  })

  it('scrolls when the newest pending message is already rendered', () => {
    const target = resolveNewMessageJump({
      pendingIds: ['n1'],
      latestPageIds: ['n1', 'a', 'b'],
      renderedIds: new Set(['n1', 'a', 'b']),
    })

    expect(target).toEqual({ kind: 'scroll', messageId: 'n1' })
  })

  it('scrolls when the newest pending message is in the latest page but not yet rendered', () => {
    // 合并后它会被渲染出来，交给已有的 scrollto 重试逻辑定位
    const target = resolveNewMessageJump({
      pendingIds: ['n1'],
      latestPageIds: ['n1', 'a', 'b'],
      renderedIds: new Set(['a', 'b']),
    })

    expect(target).toEqual({ kind: 'scroll', messageId: 'n1' })
  })

  it('picks the newest pending id when several arrived', () => {
    // socket 按到达顺序追加，末尾即最新；信息流里新消息在顶部，所以跳最新的那条
    const target = resolveNewMessageJump({
      pendingIds: ['old1', 'newer'],
      latestPageIds: ['newer', 'old1'],
      renderedIds: new Set(['old1']),
    })

    expect(target).toEqual({ kind: 'scroll', messageId: 'newer' })
  })

  it('falls back to the top of the feed when the socket told us nothing', () => {
    const target = resolveNewMessageJump({
      pendingIds: [],
      latestPageIds: ['n1', 'a'],
      renderedIds: new Set(['a']),
    })

    expect(target).toEqual({ kind: 'top' })
  })

  it('does not claim to scroll to a message that is in neither the feed nor the socket list', () => {
    // pendingIds 为空但 latestPageIds 里有新东西（窗口聚焦时静默刷新拉的）：
    // 没有 socket id 可跳，退回顶部，而不是跳到一个用户没被告知的消息上
    const target = resolveNewMessageJump({
      pendingIds: [],
      latestPageIds: ['n1', 'a'],
      renderedIds: new Set(['a']),
    })

    expect(target.kind).toBe('top')
  })
})
