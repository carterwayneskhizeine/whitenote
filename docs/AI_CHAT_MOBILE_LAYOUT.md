# AI Chat 移动端布局文档

## 概述

本文档记录 AI Chat 页面在移动端和桌面端的布局实现，包括顶部标题栏固定、底部输入框适配，以及键盘弹出处理。

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/app/aichat/page.tsx` | AI Chat 页面主组件（含 Visual Viewport API 处理） |
| `src/components/OpenClawChat/ChatWindow.tsx` | 聊天窗口组件（含输入框） |

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
  <div className="flex flex-col flex-1 min-h-0 pt-[52px] pb-safe-or-4 desktop:pt-0 desktop:pb-0">
    {/* 错误提示 */}
    {error && (...)}

    {/* 消息列表 */}
    <ScrollArea className="flex-1 w-full min-h-0">
      <div className="space-y-4 w-full px-4 min-w-0">
        {/* 消息渲染... */}
      </div>
    </ScrollArea>

    {/* 输入框 */}
    <form onSubmit={handleSubmit} className="p-4 pb-safe-or-4 border-t w-full shrink-0 bg-background">
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
| `pb-safe-or-4` | 移动端底部安全区域内边距，适配键盘弹出 |
| `desktop:pt-0 desktop:pb-0` | 桌面端移除额外内边距 |

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

- 使用 `pb-safe-or-4` 适配安全区域
- 键盘弹出时，输入框随视窗底部移动
- 桌面端移除底部内边距

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
│                 │         │                 │
│                 │         │                 │
├─────────────────┤         ├─────────────────┤
│ 输入框          │         │ 输入框          │
│ pb-safe-or-4   │         │                 │
└─────────────────┘         └─────────────────┘
  ↑ MobileNav (53px)          (无底部导航)
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
