/**
 * 信息流是「置顶优先 + updatedAt 倒序」，所以新消息出现在顶部。
 * 这里只保留合并逻辑（纯函数），便于单测覆盖「不丢失已加载分页」这一行为。
 */

export interface MergeableMessage {
  id: string
}

export interface MergeResult<T extends MergeableMessage> {
  /** 合并后的完整列表：最新一页在前，已加载但不在这一页里的旧消息接在后面 */
  merged: T[]
  /** 本次真正新增的最靠上的一条消息 id；没有新增时为 null */
  firstNewId: string | null
}

export function mergeLatestMessages<T extends MergeableMessage>(
  current: T[],
  latest: T[],
): MergeResult<T> {
  const currentIds = new Set(current.map((m) => m.id))
  const latestIds = new Set(latest.map((m) => m.id))

  // 最新一页的顺序由服务端保证，直接沿用；其余已加载的消息保持原有相对顺序
  const merged = [
    ...latest,
    ...current.filter((m) => !latestIds.has(m.id)),
  ]

  const firstNewId = latest.find((m) => !currentIds.has(m.id))?.id ?? null

  return { merged, firstNewId }
}
