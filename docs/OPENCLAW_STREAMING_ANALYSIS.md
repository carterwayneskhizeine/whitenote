# OpenClaw 流式响应分析报告

> 分析时间：2026-02-25
> 涉及文件：`src/app/api/openclaw/chat/stream/route.ts`、`src/components/OpenClawChat/api.ts`

## 背景

WhiteNote 集成了 OpenClaw Gateway 作为 AI 对话后端。目标是实现与 OpenClaw Dashboard（`http://127.0.0.1:18789/`）一致的流式响应效果（打字机动画）。

本文档记录了调试过程中发现的关键问题及解决方案。

---

## 一、OpenClaw Gateway 事件协议

OpenClaw Gateway 通过 WebSocket 推送两类关键事件：

### 1. `agent` 事件（旧接口，不推荐用于流式）

```jsonc
{
  "event": "agent",
  "payload": {
    "stream": "assistant",
    "data": {
      "delta": "晨曦初露映金葵，\n...",   // 增量文本（但实际是完整快照）
      "text": "晨曦初露映金葵，\n..."     // 完整文本
    }
  }
}
```

- `stream: "assistant"` 时携带响应文本
- `delta` 字段**看起来**是增量，但实际上只触发一次，包含完整响应
- 没有 thinking/reasoning 内容

### 2. `chat` 事件（Dashboard 使用的接口，推荐）

```jsonc
{
  "event": "chat",
  "payload": {
    "sessionKey": "agent:main:main",
    "runId": "8f73a4fa-...",
    "seq": 2,
    "state": "delta",                    // 或 "final" / "error" / "aborted"
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text",     "text": "晨曦初露映金葵，\n..." },
        { "type": "thinking", "thinking": "让我思考一下..." }  // 如果有 extended thinking
      ],
      "timestamp": 1771966716648
    }
  }
}
```

- `state: "delta"` — 中间状态，包含累积快照（每次是**完整**内容，非增量）
- `state: "final"` — 最终状态，标记响应完成
- `content[]` 支持 `text` 块和 `thinking` 块（extended thinking）

---

## 二、Dashboard 的实现方式

通过阅读 `D:\Code\openclaw\ui\src\ui\controllers\chat.ts` 和 `chat\message-extract.ts`：

- Dashboard 监听 `chat.delta` 事件（`state === 'delta'`）
- 从 `payload.message.content[]` 提取 `text` 和 `thinking` 块
- **替换**（而非追加）`chatStream` 状态——因为每个 `delta` 已经是完整快照
- 看上去有流式效果，是因为响应期间会收到**多个** `chat.delta` 事件（每个工具调用完成后都会触发）

关键函数（`message-extract.ts`）：
```typescript
function extractText(message): string {
  return message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
}

function extractThinking(message): string {
  return message.content
    .filter(b => b.type === 'thinking')
    .map(b => b.thinking)
    .join('\n')
}
```

---

## 三、日志分析

### 日志 1：涉及工具调用的响应（`openclaw-2026-02-24T20-55-59.jsonl`）

| seq | state | 内容 |
|-----|-------|------|
| 29  | delta | "Session startup complete. Now greeting the user in my persona:" |
| 32  | delta | "Hey Goldie! 🌻\n\n新的一天又开始了~..." |
| 33  | final | — |

- 共 **2 个** `chat.delta` 事件，seq=29 是工具调用中间状态，seq=32 是最终文本
- 两个 delta 事件之间有约 4 秒间隔 → **这种情况下可以看到流式效果**

### 日志 2：简单响应（`openclaw-2026-02-24T20-58-29.jsonl`）

| seq | state | 内容 |
|-----|-------|------|
| 2   | delta | "晨曦初露映金葵，\n代码如诗智慧随。..." |
| 3   | final | — |

- 只有 **1 个** `chat.delta` 事件，4ms 后紧跟 `final`
- **这就是流式效果消失的根本原因**（见下节）

---

## 四、根本问题：React 18 自动批处理

### 问题描述

当 `chat.delta` 和 `chat.final` 仅相差 **4ms**，它们会出现在**同一个 SSE `reader.read()` chunk** 中。

```
[SSE chunk]
data: {"type":"content","content":"完整响应..."}

data: {"type":"finish","runId":"..."}
```

浏览器 `ReadableStream` 的 `read()` 一次性返回两条事件。前端代码连续触发：

```typescript
setMessages(prev => ...)    // 更新内容
// 4ms 后...
setIsLoading(false)          // 结束加载
```

**React 18 自动批处理**（Automatic Batching）将这两个 `setState` 合并为**一次渲染**。结果：

- `isStreaming` 条件（`isPending && isLoading`）从未为 `true`
- 流式视图（打字机动画）**从未被渲染**
- 用户看到的是：空白 → 3个点动画 → 突然出现完整文本

### 代码中的体现

`ChatWindow.tsx` 中：
```typescript
const isPending = message.id.startsWith('pending-') && isLoading
// 当 isLoading 已经是 false 时，isPending 永远是 false
// AIMessageViewer 的 isStreaming={isPending} 永远是 false
```

---

## 五、Session Key 匹配逻辑

OpenClaw Gateway 的 `chat` 事件中，`sessionKey` 格式为 `agent:main:main`。

当用户在 API 中指定 `sessionKey = 'main'` 时，需要匹配规则：

```typescript
const isMatch =
  eventSessionKey === sessionKey ||                          // 'main' === 'main'
  eventSessionKey === `agent:${sessionKey}:${sessionKey}` || // 'agent:main:main'
  eventSessionKey?.endsWith(`:${sessionKey}`)               // 以 ':main' 结尾
```

---

## 六、已实施的修改

### `route.ts`：从 `agent.assistant` 切换到 `chat.delta`

```typescript
// 旧代码（错误）：监听 agent.assistant
if (eventFrame.event === 'agent' && data.stream === 'assistant') {
  sendEvent({ type: 'content', content: data.delta })
}

// 新代码（正确）：监听 chat.delta，提取 content[] 块
if (eventFrame.event === 'chat') {
  const payload = eventFrame.payload
  if (payload.state === 'delta') {
    const textFull = payload.message.content
      .filter(b => b.type === 'text').map(b => b.text).join('\n')
    const thinkingFull = payload.message.content
      .filter(b => b.type === 'thinking').map(b => b.thinking).join('\n')
    if (textFull) sendEvent({ type: 'content', content: textFull, delta: textFull })
    if (thinkingFull) sendEvent({ type: 'reasoning', content: thinkingFull, delta: thinkingFull })
  } else if (payload.state === 'final') {
    sendEvent({ type: 'finish', ... })
  }
}
```

### `api.ts`：从增量累积切换到快照替换

```typescript
// 旧代码（错误）：累积追加
accumulatedContent += delta
onChunk(delta, accumulatedContent)

// 新代码（正确）：直接用 content 作为完整快照
const fullContent = data.content || data.delta || ''
onChunk(fullContent, fullContent)
```

---

## 七、待解决问题与修复方案

### 问题：React 18 批处理导致流式视图从不渲染

**方案 A：在 `onFinish` 前添加延迟（推荐）**

在 `api.ts` 中，当收到 `finish` 事件前先等待一段时间，让 React 有机会先渲染内容状态：

```typescript
} else if (data.type === 'finish') {
  // 延迟 finish，打破 React 18 批处理
  // 让 content 状态先渲染，再结束加载状态
  if (hadContent) {
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
  onFinish()
  return
}
```

**方案 B：TypewriterText 组件**

即使没有真正的流式数据，也可以用打字机动画模拟效果：

```typescript
// AIMessageViewer.tsx
function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!text) return
    setDisplayed('')
    let i = 0
    const speed = 3 // chars per frame
    const animate = () => {
      i += speed
      setDisplayed(text.slice(0, i))
      if (i < text.length) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [text])

  return <span>{displayed}<span className="animate-pulse">|</span></span>
}
```

两个方案可以结合使用：延迟确保流式视图有机会渲染，TypewriterText 提供视觉动画效果。

---

## 八、OpenClaw 流式响应行为总结

| 场景 | `chat.delta` 数量 | 流式效果 |
|------|------------------|----------|
| 无工具调用的简单响应 | 1 个（完整文本）| ❌ 无效果（delta 和 final 同时到达） |
| 有工具调用的响应 | N 个（每次工具调用后一个）| ✅ 有效果（工具调用间有时间间隔） |
| Extended thinking 响应 | 多个 | ✅ thinking 块逐步增长 |

**结论**：OpenClaw Gateway **不是 token 级别的流式**，而是**检查点级别的流式**（每完成一个工具调用或推理阶段触发一次）。对于简单的单轮对话，实际上没有流式数据，需要前端模拟动画效果。
