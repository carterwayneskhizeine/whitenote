# 内容溢出检测问题分析

## 问题描述

在 WhiteNote 中，当消息内容超过一定行数（默认 9 行）时，应该显示"显示更多"按钮来展开完整内容。

### 当前行为

- **普通文本**：正常工作，超过 9 行显示"显示更多"
- **代码块**：不工作，代码块被视为一行，即使内容很长也不触发"显示更多"

### 示例内容

```markdown
我已经
```
openclaw agents add goldie-code
```
```
openclaw channels add --channel telegram --account goldie06 --token ...
```
...（多个代码块）
```
{ "meta": { ... }, "wizard": { ... }, ... }
```

这个内容包含多个短代码块和一个超长的 JSON 代码块，预期应该触发"显示更多"，但没有。

## 根本原因分析

### 1. CSS `line-clamp` 的限制

```css
.line-clamp-9 {
  display: -webkit-box;
  -webkit-line-clamp: 9;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

- `line-clamp` 基于行数，但代码块（`<pre>`）使用 `white-space: pre`
- 整个代码块被当作一行处理，不受行数限制

### 2. 代码块的样式特性

```css
.ProseMirror pre {
  white-space: pre;
  overflow-y: hidden;
}
```

`white-space: pre` 导致代码块内容不换行，高度由单行长度决定。

### 3. 溢出检测的困难

#### 尝试方案 1：检测 `scrollHeight > clientHeight`

```javascript
const hasOverflow = el.scrollHeight > el.clientHeight
```

**问题**：当设置了 `max-height` 和 `overflow: hidden` 后，`scrollHeight` 返回的是被截断后的高度（280px），不是真实高度。

#### 尝试方案 2：检测代码块高度

```javascript
const codeBlocks = proseMirror.querySelectorAll('pre')
codeBlocks.forEach((pre) => {
  if (pre.offsetHeight > 160) {  // 160px ≈ 10em
    hasOverflow = true
  }
})
```

**问题**：
- 折叠时代码块不可见，`offsetHeight` 返回 0 或很小
- 需要在检测前临时展开，导致闪烁

#### 尝试方案 3：临时移除 `max-height`

```javascript
const originalMaxHeight = el.style.maxHeight
el.style.maxHeight = 'none'
const fullHeight = el.scrollHeight
el.style.maxHeight = originalMaxHeight
```

**问题**：
- 视觉闪烁
- `scrollHeight` 仍然返回被限制的高度
- 需要强制重绘（force reflow）才能获取正确高度

## 已尝试的解决方案

### 方案 A：给代码块添加 `max-height`

```css
.is-collapsed .ProseMirror pre {
  max-height: 10em;
  overflow: hidden;
}
```

**结果**：代码块被截断，但整个"显示更多"按钮不显示。

### 方案 B：给容器添加 `max-height`

```css
.is-collapsed .ProseMirror {
  max-height: 20em;
  overflow: hidden;
}
```

**结果**：`scrollHeight` 检测失效。

### 方案 C：使用 `ResizeObserver`

```javascript
const resizeObserver = new ResizeObserver(checkOverflow)
resizeObserver.observe(container)
```

**结果**：无法解决 `scrollHeight` 被限制的问题。

## 技术难点总结

1. **CSS 限制影响 DOM 测量**：设置了 `max-height` 和 `overflow: hidden` 后，DOM API 返回的都是被限制的值
2. **代码块的特殊样式**：`white-space: pre` 使代码块不参与行数计算
3. **检测时机问题**：需要在 CSS 限制生效前检测，但此时 DOM 可能未完全渲染
4. **性能与体验的权衡**：频繁的 DOM 测量会影响性能，临时展开会导致闪烁

## 可能的解决方向

### 方向 1：使用 JavaScript 计算行数

```javascript
function countLines(element) {
  // 遍历所有子元素，计算实际渲染行数
  // 代码块按实际行数计算，而非 1 行
}
```

**优点**：精确控制
**缺点**：实现复杂，性能开销大

### 方向 2：基于内容长度估算

```javascript
// 统计内容行数（包括代码块内的换行符）
const lines = content.split('\n').length
const codeBlocks = (content.match(/```/g) || []).length / 2
const estimatedLines = lines + codeBlocks * 10
```

**优点**：无需 DOM 测量
**缺点**：估算不准确，无法考虑字体大小等因素

### 方向 3：使用虚拟滚动容器

```javascript
// 不使用 CSS 限制，用 JS 计算可见区域
// 类似于虚拟列表的实现
```

**优点**：精确控制可见内容
**缺点**：重构工作量大

### 方向 4：隐藏测量法 ✅ （已采用）

**实现位置**：[src/components/TipTapViewer.tsx:92-163](../../src/components/TipTapViewer.tsx#L92-L163)

**核心算法**：
```javascript
const measureFullHeight = () => {
  // 1. 克隆 ProseMirror 内容到隐藏容器
  const measureContainer = document.createElement('div')
  measureContainer.style.position = 'fixed'
  measureContainer.style.left = '-9999px'  // 屏幕外，不影响布局
  measureContainer.style.visibility = 'hidden'

  // 2. 克隆内容，移除所有 CSS 限制
  const clonedContent = proseMirror.cloneNode(true)
  clonedContent.style.maxHeight = 'none'
  clonedContent.style.overflow = 'visible'

  // 3. 测量完整高度
  document.body.appendChild(measureContainer)
  const fullHeight = clonedContent.scrollHeight

  // 4. 清理资源
  document.body.removeChild(measureContainer)
  return fullHeight
}
```

**优点**：
- ✅ 准确：不受 CSS 限制影响，能正确测量代码块高度
- ✅ 无闪烁：不修改原始 DOM，无需临时展开
- ✅ 高效：只克隆一次，O(n) 复杂度可接受
- ✅ 兼容性好：纯 DOM API，无依赖

## 当前状态

### ✅ 已解决

当内容包含多个代码块时，"显示更多"按钮现在能正确显示。

**工作原理**：
1. 隐藏地克隆 ProseMirror 内容
2. 移除 CSS 限制（maxHeight、overflow）
3. 测量真实的内容高度（包括代码块）
4. 与 320px 限制对比判断是否溢出

**测试场景**：
- ✅ 普通文本：超过 9 行显示"显示更多"
- ✅ 单个代码块：代码块高度 > 320px 时显示"显示更多"
- ✅ 多个代码块：内容总高度 > 320px 时显示"显示更多"
- ✅ 长代码块：即使是一行超长代码也能被正确检测

**调试信息**：
在浏览器控制台可看到 `[TipTapViewer] Overflow check` 日志，显示完整高度、限制高度和是否溢出的判断结果。
