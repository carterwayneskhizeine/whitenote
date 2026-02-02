# 图片灯箱索引修复文档

## 问题描述

点击 Markdown 中的不同图片时，灯箱总是显示同一张图片（通常是第3张或第4张），而不是用户点击的那张图片。灯箱的计数器显示的图片数量也与实际不符。

## 问题原因

### 1. **闭包变量引用问题**

在 `TipTapViewer.tsx` 中，图片点击处理器使用了闭包捕获 `markdownIndex` 变量：

```typescript
// ❌ 错误的实现
let markdownIndex = 0
images.forEach((img: Element) => {
  const handleClick = (e: MouseEvent) => {
    onImageClick(markdownIndex, src) // 捕获了引用，不是值
  }
  imageElement.addEventListener('click', handleClick)
  markdownIndex++
})
```

由于 JavaScript 闭包捕获的是变量的引用而非值，当 `markdownIndex++` 执行后，所有已创建的 `handleClick` 函数都会看到更新后的值。导致所有图片点击时都传递相同的索引。

### 2. **React 状态更新时序问题**

在 `MessageCard.tsx` 中，使用 `setState` 批处理更新时，由于 React 的自动批处理机制，`initialIndex` prop 可能在组件第一次渲染时还是旧值：

```typescript
setLightboxIndex(targetIndex)
setLightboxOpen(true) // 这两个更新可能被批处理
```

### 3. **图片索引计算错误**

最初的实现使用 `forEach` 的 `index` 参数，但这个索引是 DOM 中所有图片（包括头像、图标等）的全局索引，而不是仅 Markdown 图片的索引：

```typescript
// ❌ 错误：这会计算所有图片的索引
images.forEach((img: Element, index: number) => {
  // index 包含头像等非 Markdown 图片
})
```

## 解决方案

### 1. **修复闭包捕获问题**

使用局部变量捕获当前索引值：

```typescript
// ✅ 正确的实现
images.forEach((img: Element) => {
  const currentIndex = markdownIndex // 创建局部变量捕获当前值

  const handleClick = (e: MouseEvent) => {
    onImageClick(currentIndex, src) // 每个处理器捕获自己的值
  }

  imageElement.addEventListener('click', handleClick)
  markdownIndex++
})
```

### 2. **使用 key 强制重新挂载组件**

在 `ImageLightbox.tsx` 和 `MessageCard.tsx` 中使用 `key` prop，确保索引变化时组件重新挂载：

```typescript
// MessageCard.tsx
<ImageLightbox
  key={`lightbox-${lightboxOpen ? 'open' : 'closed'}-${lightboxIndex}`}
  initialIndex={lightboxIndex}
  open={lightboxOpen}
  // ...
/>

// ImageLightbox.tsx
return <LightboxContent
  key={`${open}-${initialIndex}`}
  slides={slides}
  initialIndex={initialIndex}
  // ...
/>
```

### 3. **正确识别 Markdown 图片**

只处理 Markdown 内容中的图片，使用 `imageUrls` 列表进行匹配：

```typescript
const isMarkdownImage = imageUrls.some(url => src.includes(url))

if (isMarkdownImage && !imageElement.dataset.lightboxHandled) {
  // 只为 Markdown 图片分配索引
}
```

### 4. **使用 useCallback 稳定回调函数**

在 `MessageCard.tsx` 中使用 `useCallback` 避免不必要的重新渲染：

```typescript
const handleMarkdownImageClick = useCallback((index: number, url: string) => {
  const mediaCount = message.medias?.length || 0
  const targetIndex = mediaCount + index

  setLightboxIndex(targetIndex)
  setLightboxOpen(true)
}, [message.medias?.length])
```

## 关键要点

1. **闭包陷阱**：在循环中创建异步回调时，必须使用局部变量捕获当前值，而不是直接引用循环变量

2. **React key 的正确使用**：当组件需要根据 props 变化完全重新挂载时，使用 `key` prop 是最可靠的方法

3. **索引管理**：确保索引的计算逻辑清晰，只计算需要的元素（如只计算 Markdown 图片）

4. **状态更新顺序**：React 18 的自动批处理可能导致状态更新时序问题，使用 key 强制重新挂载可以避免这类问题

## 测试验证

点击 Markdown 中的不同图片时，控制台应该输出正确的索引：

```
TipTapViewer - markdown image clicked, index: 0 src: ...
handleMarkdownImageClick - markdown index: 0 mediaCount: 0 targetIndex: 0

TipTapViewer - markdown image clicked, index: 1 src: ...
handleMarkdownImageClick - markdown index: 1 mediaCount: 0 targetIndex: 1

TipTapViewer - markdown image clicked, index: 2 src: ...
handleMarkdownImageClick - markdown index: 2 mediaCount: 0 targetIndex: 2
```

## 相关文件

- `src/components/TipTapViewer.tsx` - 图片点击处理器
- `src/components/ImageLightbox.tsx` - 灯箱组件
- `src/components/MessageCard.tsx` - 消息卡片组件
