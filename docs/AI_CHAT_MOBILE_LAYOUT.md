# AI Chat 移动端布局文档

## 概述

本文档记录 AI Chat 页面在移动端和桌面端的布局实现，包括顶部标题栏固定和底部输入框适配。

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/app/aichat/page.tsx` | AI Chat 页面主组件 |
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
  return (
    <div className="flex flex-col h-[100dvh] desktop:h-screen desktop:pt-0">
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
| `h-[100dvh]` | 移动端使用动态视窗高度，处理键盘弹出 |
| `desktop:h-screen` | 桌面端使用屏幕高度 |
| `fixed desktop:relative` | 移动端固定定位，桌面端相对定位 |
| `z-50 desktop:z-0` | 移动端层级50，桌面端默认层级 |
| `top-0 left-0 right-0` | 固定在顶部 |

## 聊天窗口组件

### src/components/OpenClawChat/ChatWindow.tsx

```tsx
return (
  <div className="flex flex-col flex-1 min-h-0 pt-[52px] pb-[53px] desktop:pt-0 desktop:pb-0">
    {/* 错误提示 */}
    {error && (...)}

    {/* 消息列表 */}
    <ScrollArea className="flex-1 w-full min-h-0">
      <div className="space-y-4 w-full px-4 min-w-0">
        {/* 消息渲染... */}
      </div>
    </ScrollArea>

    {/* 输入框 */}
    <form onSubmit={handleSubmit} className="p-4 border-t w-full shrink-0 bg-background">
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
| `pb-[53px]` | 移动端底部内边距，避开底部导航栏 |
| `desktop:pt-0 desktop:pb-0` | 桌面端移除额外内边距 |

## 移动端适配要点

### 1. 视窗高度

- 使用 `100dvh` 而非 `100vh`，解决移动端浏览器地址栏显示/隐藏导致的视窗变化问题

### 2. 顶部标题栏

- 固定在顶部 (`fixed top-0`)
- 使用 `z-50` 确保在其他内容之上
- 桌面端切换为 `relative` 回归正常文档流

### 3. 底部输入框

- 通过父容器 `pb-[53px]` 预留空间
- 底部导航栏高度为 53px (`h-[53px]`)
- 桌面端移除底部内边距

### 4. 键盘弹出处理

- `100dvh` 会随键盘弹出自动调整视窗高度
- 输入框不会被键盘遮挡

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
│ pb-[53px]      │         │                 │
└─────────────────┘         └─────────────────┘
  ↑ MobileNav (53px)          (无底部导航)
```

## 相关常量

```css
/* 底部导航栏高度 */
MobileNav: h-[53px]

/* 顶部标题栏高度 */
约 52px (padding: py-3 = 12px*2 + 字体高度)
```
