/**
 * 帖子详情页左上角「返回」该回到哪个信息流。
 *
 * 信息流是按 workspace 过滤的。跨 workspace 打开的新消息帖，如果返回时
 * 沿用来处 workspace，回到的信息流里根本没有这条帖子；所以优先回到帖子
 * 自己所属的 workspace，再滚动定位到它。
 */
export function buildStatusBackHref(
  messageId: string,
  messageWorkspaceId?: string | null,
  fallbackWorkspaceId?: string | null
): string {
  const workspaceId = messageWorkspaceId || fallbackWorkspaceId
  if (!workspaceId) {
    return `/?scrollto=${messageId}`
  }
  return `/?scrollto=${messageId}&workspace=${encodeURIComponent(workspaceId)}`
}
