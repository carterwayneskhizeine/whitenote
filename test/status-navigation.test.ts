import { describe, it, expect } from 'vitest'
import { buildStatusBackHref } from '@/lib/status-navigation'

describe('buildStatusBackHref', () => {
  // 信息流按 workspace 过滤：新消息可能在另一个 workspace，
  // 返回时必须回到帖子自己的 workspace，否则帖子里根本不在返回后的信息流里。
  it('returns to the post workspace even when it was opened from another workspace', () => {
    expect(buildStatusBackHref('msg_1', 'ws_post', 'ws_origin')).toBe(
      '/?scrollto=msg_1&workspace=ws_post'
    )
  })

  it('falls back to the from workspace when the post has no workspace', () => {
    expect(buildStatusBackHref('msg_1', null, 'ws_origin')).toBe(
      '/?scrollto=msg_1&workspace=ws_origin'
    )
  })

  it('omits the workspace when neither source is known', () => {
    expect(buildStatusBackHref('msg_1')).toBe('/?scrollto=msg_1')
  })

  it('encodes workspace ids that need escaping', () => {
    expect(buildStatusBackHref('msg_1', 'ws/a&b')).toBe(
      '/?scrollto=msg_1&workspace=ws%2Fa%26b'
    )
  })
})
