/**
 * 「有新消息」按钮点击后该去哪里。
 *
 * 背景：socket 的 `message:created` 是按 user 房间广播的，**不区分 workspace**，
 * 而信息流是按当前 workspace 分页的。用户完全可能在 workspace A 的信息流里，
 * 收到 workspace B 新消息的推送 —— 这时那条消息永远不可能出现在 A 的第一页，
 * 滚也滚不到（这正是「点了按钮没反应」的根因）。
 *
 * 所以优先用 socket 明确告知的 messageId：
 *   - 该 id 在当前信息流里（或合并后会在）→ 滚动定位，保住已加载的分页和滚动位置
 *   - 不在（多半是别的 workspace）→ 跳详情页，那才是用户真正想去的地方
 *   - 没有 id 可用（socket 没推、或网络失败）→ 退回信息流顶部
 */

export type NewMessageJump =
  | { kind: 'scroll'; messageId: string }
  | { kind: 'navigate'; messageId: string }
  | { kind: 'top' }

export function resolveNewMessageJump({
  pendingIds,
  latestPageIds,
  renderedIds,
}: {
  /** socket 推来的新消息 id，按到达顺序追加，末尾即最新 */
  pendingIds: string[]
  /** 当前 workspace 最新一页里的 id（服务端顺序：置顶优先 + updatedAt 倒序） */
  latestPageIds: string[]
  /** 已经渲染在 DOM 里的 id */
  renderedIds: Set<string>
}): NewMessageJump {
  // 最新的那条优先：信息流里新消息在顶部
  const targetId = pendingIds.length > 0 ? pendingIds[pendingIds.length - 1] : null
  if (!targetId) {
    return { kind: 'top' }
  }

  // 已经在列表里，或者合并之后就会进列表 → 滚动定位
  if (renderedIds.has(targetId) || latestPageIds.includes(targetId)) {
    return { kind: 'scroll', messageId: targetId }
  }

  // 当前 workspace 的信息流里没有它（多半是别的 workspace）→ 跳详情页。
  // /api/messages/[id] 不按 workspace 过滤，所以跨 workspace 也能打开。
  return { kind: 'navigate', messageId: targetId }
}
