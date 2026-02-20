# AI Chat 移动端布局文档

## 概述

本文档记录 AI Chat 页面在移动端和桌面端的布局实现，包括顶部标题栏固定、底部输入框适配，以及键盘弹出处理。

## 更新日志

### 2026-02-20: 全屏输入模式与自动扩展输入框

实现了 Twitter 风格的输入框 UI，包含：
- 自动扩展到最多3行的 textarea
- 全屏输入模式切换按钮
- 更现代的圆角设计

```tsx
// src/components/OpenClawChat/ChatWindow.tsx

// 自动调整 textarea 高度 (最多3行)
const adjustTextareaHeight = useCallback(() => {
  const textarea = inputRef.current
  if (!textarea) return
  
  textarea.style.height = 'auto'
  const lineHeight = 22
  const maxHeight = lineHeight * 3 + 16
  const newHeight = Math.min(textarea.scrollHeight, maxHeight)
  textarea.style.height = `${newHeight}px`
}, [])

// 全屏输入模式
const [isFullscreen, setIsFullscreen] = useState(false)

// 输入框样式 (Twitter 风格)
<div className="flex-1 relative flex items-end bg-muted/30 rounded-2xl border border-transparent focus-within:border-primary/20 focus-within:bg-muted/50 transition-colors">
  <textarea
    className="flex-1 w-full min-h-[40px] max-h-[82px] resize-none bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
    rows={1}
  />
  <Button onClick={toggleFullscreen} className="rounded-full">
    <Maximize2 className="w-4 h-4" />
  </Button>
</div>
```

全屏模式渲染：
```tsx
if (isFullscreen) {
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">New Message</h2>
        <Button variant="ghost" size="icon" onClick={closeFullscreen}>
          <X className="w-5 h-5" />
        </Button>
      </div>
      {/* 全屏输入区域 */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <textarea className="flex-1 w-full resize-none bg-transparent px-4 py-3 text-base" />
        {/* 底部发送按钮 */}
      </form>
    </div>
  )
}
```

### 2026-02-15: 历史记录加载

在页面加载时从 OpenClaw Gateway API 获取聊天历史记录：

```tsx
// src/components/OpenClawChat/ChatWindow.tsx
useEffect(() => {
  const loadHistory = async () => {
    try {
      const history = await openclawApi.getHistory(DEFAULT_SESSION_KEY)
      if (history.length > 0) {
        const messagesWithIds: ChatMessage[] = history.map((msg, idx) => ({
          ...msg,
          id: msg.timestamp ? `${msg.timestamp}-${idx}` : `msg-${idx}`,
          content: msg.content,
          timestamp: msg.timestamp ?? Date.now(),
        }))
        setMessages(messagesWithIds)
      }
    } catch (err) {
      console.error('[OpenClawChat] Failed to load history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }
  loadHistory()
}, [])
```

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/app/aichat/page.tsx` | AI Chat 页面主组件（含 Visual Viewport API 处理） |
| `src/components/OpenClawChat/ChatWindow.tsx` | 聊天窗口组件（含输入框、历史记录加载） |
| `src/components/OpenClawChat/AIMessageViewer.tsx` | AI 消息 Markdown 查看器 |

## 断点配置

项目使用 Tailwind CSS v4，桌面端断点为 **750px**：

```css
/* src/app/globals.css:48 */
--breakpoint-desktop: 750px;
```

使用 `desktop:` 前缀表示 >= 750px 生效。

## 页面结构

### src/app/aichat/page.tsx

```tsx
export default function AIChatPage() {
  const [viewportHeight, setViewportHeight] = useState(0)

  // Handle Visual Viewport API for keyboard
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
      }
    }

    handleResize()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  return (
    <div
      className="flex flex-col"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100vh', overflow: 'hidden' }}
    >
      <div className="shrink-0 border-b px-4 py-3 bg-background desktop:bg-transparent z-50 desktop:z-0 fixed desktop:relative top-0 left-0 right-0">
        <h1 className="text-xl font-bold">AI Chat</h1>
      </div>
      <ChatWindow />
    </div>
  )
}
```

### 关键样式说明

| 类名 | 作用 |
|------|------|
| `viewportHeight` state | 使用 Visual Viewport API 监听视窗变化 |
| `style={{ height: viewportHeight ? ... }}` | 动态设置容器高度，跟随键盘弹出/收起 |
| `overflow: 'hidden'` | 防止滚动溢出 |
| `fixed desktop:relative` | 移动端固定定位，桌面端相对定位 |
| `z-50 desktop:z-0` | 移动端层级50，桌面端默认层级 |
| `top-0 left-0 right-0` | 固定在顶部 |

## 聊天窗口组件

### src/components/OpenClawChat/ChatWindow.tsx

```tsx
return (
  <div className="flex flex-col flex-1 min-h-0 pt-[52px] desktop:pt-0">
    {/* 错误提示 */}
    {error && (...)}

    {/* 消息列表 */}
    <ScrollArea className="flex-1 w-full min-h-0">
      <div className="space-y-4 w-full px-4 min-w-0 pb-4">
        {/* 消息渲染... */}
      </div>
    </ScrollArea>

    {/* 输入框 - 固定在底部 */}
    <form onSubmit={handleSubmit} className="p-4 pb-safe-or-4 border-t w-full shrink-0 bg-background fixed bottom-[53px] left-0 right-0 z-40 desktop:relative desktop:bottom-0">
      <div className="flex gap-2">
        <textarea ... />
        <Button ... />
      </div>
    </form>
  </div>
)
```

### 关键样式说明

| 类名 | 作用 |
|------|------|
| `pt-[52px]` | 移动端顶部内边距，避开固定标题栏 |
| `pb-4` | 消息列表底部内边距，避免最后一条消息被输入框遮挡 |
| `fixed bottom-[53px]` | 移动端固定在底部导航栏上方 (53px = 导航栏高度) |
| `z-40` | 与 MobileNav 相同层级 |
| `desktop:relative desktop:bottom-0` | 桌面端回归正常文档流 |

### 消息渲染

ChatWindow 中使用 `AIMessageViewer` 组件渲染消息内容：

```tsx
// src/components/OpenClawChat/ChatWindow.tsx
// 使用 key 强制内容变化时重新渲染
<AIMessageViewer 
  key={`${message.id}-${message.content.slice(0, 20)}`}
  content={message.content} 
  className={message.role === 'user' ? 'text-primary-foreground' : ''}
/>
```

> **注意**: 必须使用 `key` 属性，否则轮询更新时 TipTap 编辑器不会重新渲染内容。

`AIMessageViewer` 是专门为 AI Chat 设计的精简版 Markdown 查看器，支持：
- Markdown 解析渲染
- 代码块语法高亮 + 复制按钮
- 表格显示
- 基本样式（标题、列表、链接、引用等）

## 移动端适配要点

### 1. 视窗高度与键盘处理

- 使用 **Visual Viewport API** (`window.visualViewport`) 监听视窗变化
- 键盘弹出时，`visualViewport.height` 会自动变小
- 容器高度动态设置为 `viewportHeight`，确保输入框始终可见
- `overflow: 'hidden'` 防止滚动条问题

### 2. 实现原理

```tsx
// 监听视窗变化
useEffect(() => {
  const handleResize = () => {
    if (window.visualViewport) {
      setViewportHeight(window.visualViewport.height)
    }
  }
  handleResize()
  
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize)
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize)
    }
  }
}, [])

// 动态设置容器高度
<div style={{ height: viewportHeight ? `${viewportHeight}px` : '100vh' }}>
```

### 3. 顶部标题栏

- 固定在顶部 (`fixed top-0`)
- 使用 `z-50` 确保在其他内容之上
- 桌面端切换为 `relative` 回归正常文档流

### 4. 底部输入框

- 使用 `fixed bottom-[53px]` 固定在底部导航栏上方
- `z-40` 确保与 MobileNav 同层级
- 键盘弹出时，输入框位于键盘上方、导航栏下方
- 桌面端使用 `desktop:relative` 回归正常文档流
- 消息列表添加 `pb-4` 避免最后一条消息被输入框遮挡

## 布局示意图

```
移动端 (≤749px)              桌面端 (≥750px)
┌─────────────────┐         ┌─────────────────┐
│ AI Chat    (z-50)│        │                 │
│ fixed top-0      │         │                 │
├─────────────────┤         ├─────────────────┤
│                 │         │                 │
│   消息列表      │         │   消息列表      │
│   pt-[52px]     │         │                 │
│   pb-4         │         │                 │
│                 │         │                 │
├─────────────────┤         ├─────────────────┤
│ 输入框          │         │ 输入框          │
│ fixed          │         │ (relative)      │
│ bottom-[53px]  │         │                 │
└─────────────────┘         └─────────────────┘
  ↑ MobileNav (53px)          (无底部导航)
  z-40 fixed bottom-0
```

## 与参考页面的对比

参考页面 (`src/app/status/[id]/reply/page.tsx`) 使用相同的 Visual Viewport API 方案：

| 特性 | AI Chat 页面 | 参考页面 |
|------|-------------|---------|
| 键盘处理 | Visual Viewport API | Visual Viewport API |
| 容器高度 | 动态 `viewportHeight` | 动态 `viewportHeight` |
| 底部padding | `pb-safe-or-4` | `pb-safe-or-4` |
| 布局结构 | 分离（page + ChatWindow） | 单一页面 |

## 相关常量

```css
/* 底部导航栏高度 */
MobileNav: h-[53px]

/* 顶部标题栏高度 */
约 52px (padding: py-3 = 12px*2 + 字体高度)

/* 安全区域内边距 */
pb-safe-or-4 (使用 env(safe-area-inset-bottom))
```
