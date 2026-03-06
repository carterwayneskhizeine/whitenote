# AI Chat 消息宽度溢出修复

## 问题描述

`/aichat` 页面的消息内容会超出对话框的预期宽度（约 750px），向右溢出至全视口宽度，导致页面出现横向滚动条。

## 根本原因

问题由两个独立原因叠加导致：

### 原因 1：Radix ScrollArea 的 `display: table` wrapper

Radix UI 的 `ScrollAreaPrimitive.Viewport` 内部会自动注入一个 div：

```html
<div style="min-width: 100%; display: table;">
  <!-- 内容 -->
</div>
```

`display: table` 的布局行为与 block 元素不同——它会根据内容的**固有宽度**扩展，而不受父容器 `max-width` 的约束。即使父容器设置了 `desktop:max-w-xl`（576px）和 `overflow-hidden`，这个 table div 仍然可以被内部内容撑宽，并进而撑宽整个 ScrollArea 根元素。

### 原因 2：`pre` 元素的 `overflow-x: visible`

`AIMessageViewer.tsx` 的 CSS 中，代码块 `pre` 元素设置了：

```css
.ai-message-viewer .ProseMirror pre {
  overflow-x: visible; /* 问题所在 */
  white-space: pre;
}
```

`overflow-x: visible` 让代码块内容溢出自身边界，这个溢出内容会被 `display: table` 的 wrapper 所感知并纳入宽度计算，导致整个容器被撑宽。

## 修复方案

### 修复 1：用普通 div 替换 ScrollArea（`ChatWindow.tsx`）

将 `<ScrollArea>` 替换为带 `overflow-x-hidden` 的普通 div，彻底绕过 Radix 的 `display: table` 问题：

```tsx
// 修复前
<ScrollArea className="flex-1 w-full min-h-0">
  <div className="space-y-4 w-full px-2 min-w-0 pb-4">
    ...
  </div>
</ScrollArea>

// 修复后
<div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden">
  <div className="space-y-4 w-full px-2 min-w-0 pb-4">
    ...
  </div>
</div>
```

### 修复 2：修正 `pre` 的 overflow 设置（`AIMessageViewer.tsx`）

```css
/* 修复前 */
.ai-message-viewer .ProseMirror pre {
  overflow-x: visible;
}

/* 修复后 */
.ai-message-viewer .ProseMirror pre {
  overflow-x: auto;
}
```

代码块内容过长时在 `pre` 内部横向滚动，而不是溢出到外部。

## 受影响文件

- `src/components/OpenClawChat/ChatWindow.tsx`
- `src/components/OpenClawChat/AIMessageViewer.tsx`

## 经验总结

**Radix ScrollArea 的 `display: table` 副作用**：当消息内容需要严格限宽时，Radix ScrollArea 不适合用作消息列表容器。建议改用普通 div + `overflow-y-auto overflow-x-hidden`。

**`overflow-x: visible` 会穿透父容器约束**：在 `display: table` 或 flex/grid 的特定上下文中，子元素的 `overflow: visible` 会影响父容器的宽度计算。涉及代码块的场景应始终使用 `overflow-x: auto`。
