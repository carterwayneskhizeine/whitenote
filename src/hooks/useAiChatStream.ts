"use client"

import { useCallback, useRef, useState } from "react"
import type { Comment } from "@/types/api"

export interface UseAiChatStreamOptions {
  /**
   * 服务端创建占位评论时触发（流式开始前）
   * 用于把占位评论插入本地评论列表
   */
  onCommentCreated?: (comment: Comment) => void

  /**
   * 流式完成、服务端写入最终内容时触发
   * 用于把最终内容合并到本地评论列表中的对应条目
   */
  onCommentCompleted?: (comment: Comment) => void

  /**
   * 服务端发送 error 事件或流式过程中出错时触发
   * 用于清理本地状态（如移除已插入的占位评论）
   */
  onError?: (message: string) => void
}

export interface UseAiChatStreamReturn {
  /** 当前累积的流式文本（用于显示"AI 正在输入"提示框） */
  streamingText: string

  /** 是否正在流式中 */
  isStreaming: boolean

  /**
   * 当前正在流式的评论 ID
   * 渲染评论列表时，可据此把对应条目的 content 替换为 streamingText，
   * 这样列表里也能看到流式增长的文本，而不是占位符 "Thinking..."
   */
  streamingCommentId: string | null

  /**
   * 处理 /api/ai/chat/stream 的 SSE 响应
   * 完成后会重置 isStreaming，但 streamingText 会保留以便显示 1s 渐隐
   */
  startStream: (response: Response, options?: UseAiChatStreamOptions) => Promise<void>

  /** 清空 streamingText（流式完成 1s 后调用，让提示框淡出） */
  clearStreamingText: () => void
}

/**
 * 处理 /api/ai/chat/stream 的 SSE 流式响应
 *
 * 服务端按顺序发送的事件：
 *   event: comment.created   - 占位评论已创建（content: "Thinking..."）
 *   event: content           - 流式内容片段（多次）
 *   event: comment.completed - 流式完成，最终内容已写入
 *   event: error             - 错误（服务端已自动删除占位评论）
 *
 * Bug 历史：早期实现只处理 content 事件，忽略了 comment.created / comment.completed，
 * 导致 AI 回复写入了数据库但本地评论列表里看不到，必须刷新页面。
 * 本 hook 修复此 BUG，把全部三类事件纳入前端状态机。
 */
export function useAiChatStream(): UseAiChatStreamReturn {
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingCommentId, setStreamingCommentId] = useState<string | null>(null)

  // 同步追踪最新的 streamingCommentId，避免 React 状态异步更新导致回调里读到旧值
  const streamingCommentIdRef = useRef<string | null>(null)

  const startStream = useCallback(
    async (response: Response, options: UseAiChatStreamOptions = {}) => {
      const { onCommentCreated, onCommentCompleted, onError } = options

      // 初始化流式状态
      setIsStreaming(true)
      setStreamingText("")
      streamingCommentIdRef.current = null
      setStreamingCommentId(null)

      // 用于在 catch 块里统一处理错误回调，避免重复触发
      let errorReported = false

      try {
        if (!response.ok) {
          throw new Error("AI stream request failed")
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        if (!reader) return

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue

            const eventMatch = line.match(/^event:\s*(.+)$/m)
            const dataMatch = line.match(/^data:\s*([\s\S]+)$/m)
            if (!eventMatch || !dataMatch) continue

            let data: any
            try {
              data = JSON.parse(dataMatch[1])
            } catch {
              // 忽略 JSON 解析错误（部分 chunk 可能不完整）
              continue
            }

            const eventName = eventMatch[1]

            if (eventName === "comment.created" && data.comment) {
              const comment = data.comment as Comment
              streamingCommentIdRef.current = comment.id
              setStreamingCommentId(comment.id)
              onCommentCreated?.(comment)
            } else if (eventName === "content" && data.text) {
              setStreamingText((prev) => prev + data.text)
            } else if (eventName === "comment.completed" && data.comment) {
              const comment = data.comment as Comment
              streamingCommentIdRef.current = null
              setStreamingCommentId(null)
              onCommentCompleted?.(comment)
            } else if (eventName === "error") {
              const msg = data.message || "AI service error"
              errorReported = true
              onError?.(msg)
              throw new Error(msg)
            }
          }
        }

        // 流结束时处理 buffer 中可能残留的最后一个事件
        // （服务端最后一条事件可能未带 "\n\n" 分隔符，如 Next.js 的早期关闭响应）
        if (buffer.trim()) {
          const eventMatch = buffer.match(/^event:\s*(.+)$/m)
          const dataMatch = buffer.match(/^data:\s*([\s\S]+)$/m)
          if (eventMatch && dataMatch) {
            let data: any
            try {
              data = JSON.parse(dataMatch[1])
            } catch {
              // ignore
            }
            if (data) {
              const eventName = eventMatch[1]
              if (eventName === "comment.completed" && data.comment) {
                const comment = data.comment as Comment
                streamingCommentIdRef.current = null
                setStreamingCommentId(null)
                onCommentCompleted?.(comment)
              } else if (eventName === "error") {
                const msg = data.message || "AI service error"
                errorReported = true
                onError?.(msg)
                throw new Error(msg)
              }
            }
          }
        }
      } catch (error) {
        if (!errorReported) {
          // 非 SSE error 事件抛出的异常（网络错误等）
          const msg = error instanceof Error ? error.message : "Unknown error"
          onError?.(msg)
        }
        throw error
      } finally {
        setIsStreaming(false)
      }
    },
    []
  )

  const clearStreamingText = useCallback(() => {
    setStreamingText("")
  }, [])

  return {
    streamingText,
    isStreaming,
    streamingCommentId,
    startStream,
    clearStreamingText,
  }
}