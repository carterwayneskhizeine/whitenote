# OpenClaw Chat 集成总结

## 本次修改内容

### 1. 新增功能：聊天历史持久化

#### 后端修改
- `src/lib/openclaw/gateway.ts`: 添加 `chatHistory()` 方法
- `src/app/api/openclaw/chat/history/route.ts`: 新建历史记录获取 API

#### 前端修改
- `src/components/OpenClawChat/api.ts`: 添加 `getHistory()` 方法，实现消息格式转换和过滤
- `src/components/OpenClawChat/ChatWindow.tsx`: 在组件挂载时加载历史记录

### 2. 消息显示优化

#### 消息格式转换
将 OpenClaw Gateway 返回的复杂格式简化：
- `toolCall`: `toolCall <name> <args>`
- `text`: 直接显示文本内容（移除了 `text:` 前缀）

#### 系统消息过滤
过滤掉以下系统消息：
- `System:` 开头的消息
- `Conversation info` 相关消息
- `Called the Read tool` 等调试消息
- `Reasoning STREAM` 等内部消息
- 时间戳开头的消息

#### 使用 TipTapViewer
- `ChatWindow.tsx` 使用 `TipTapViewer` 组件显示消息内容
- 支持 Markdown 渲染、代码高亮等功能

### 3. 工具调用修复

#### 修复工具调用后回复丢失问题
- `src/app/api/openclaw/chat/stream/route.ts`:
  - 添加 `chat` 事件处理（广播风格事件）
  - 添加 `extractTextFromMessage()` 函数正确提取消息文本
  - 添加 `ChatBroadcastEvent` 类型定义

### 4. 布局和样式调整

#### MainLayout 侧边栏固定
- `src/components/layout/MainLayout.tsx`:
  - LeftSidebar 容器添加 `h-screen sticky top-0`
  - RightSidebar 容器添加 `h-screen sticky top-0`

#### aichat 页面布局
- `src/app/aichat/page.tsx`:
  - 参考主页布局，使用 `flex flex-col min-h-screen pt-26.5 desktop:pt-0`
  - 添加页面标题显示

#### ChatWindow 布局调整
- 外层容器: `flex flex-col flex-1`
- ScrollArea: `flex-1 w-full`
- 消息容器: `space-y-4 w-full px-4`
- form: `p-4 border-t w-full shrink-0`
- 消息行: `flex gap-3 w-full` + Avatar 添加 `shrink-0`

## 构建方式

由于 Docker + pnpm 环境问题，需要按以下步骤构建：

```bash
rm -rf node_modules .next
pnpm install
pnpm approve-builds
pnpm prisma generate
pnpm build
```

## 当前问题

### 用户消息被右侧界面裁剪

**现象**: 
- 刷新页面后，用户消息（右对齐）会被右侧界面裁剪掉一部分
- AI 消息（左对齐）也会有部分被裁剪
- 未刷新前（流式输出时）显示正常

**已尝试的修复**:
1. 给消息容器添加 `w-full`
2. Avatar 添加 `shrink-0` 防止被压缩
3. 移除消息框的 `max-w-[600px]` 限制
4. 调整 padding 位置（从 ScrollArea 移到内部 div）
5. form 添加 `w-full shrink-0`

**可能的原因**:
- ScrollArea 组件的内部滚动容器可能有宽度限制
- 右侧 RightSidebar (390px) 可能影响中间区域的可用宽度
- 刷新后 DOM 结构可能与未刷新时不同

**待解决的线索**:
```javascript
document.querySelector("body > div.flex.min-h-screen.justify-center.w-full.bg-background.text-foreground > div > main > div.flex.flex-col.min-h-screen.pt-26\\.5.desktop\\:pt-0 > div.flex.flex-col.flex-1 > div")
```

## 相关文件清单

### 后端
- `src/lib/openclaw/gateway.ts` - WebSocket 客户端实现
- `src/app/api/openclaw/chat/stream/route.ts` - 流式聊天 API
- `src/app/api/openclaw/chat/history/route.ts` - 历史记录 API
- `src/app/api/openclaw/sessions/route.ts` - 会话管理 API

### 前端
- `src/components/OpenClawChat/types.ts` - 类型定义
- `src/components/OpenClawChat/api.ts` - API 客户端
- `src/components/OpenClawChat/ChatWindow.tsx` - 对话主组件
- `src/app/aichat/page.tsx` - AI Chat 页面

### 布局
- `src/components/layout/MainLayout.tsx` - 主布局
- `src/components/layout/LeftSidebar.tsx` - 左侧边栏
- `src/components/layout/RightSidebar.tsx` - 右侧边栏

### 其他
- `src/components/TipTapViewer.tsx` - 富文本查看器
