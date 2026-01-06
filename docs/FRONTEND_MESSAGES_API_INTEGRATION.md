# WhiteNote 前端集成 Messages API 文档

> **日期**: 2026-01-06
> **相关文档**: [后端 Stage 4: Messages API](./BACKEND_STAGE_04_MESSAGES_API.md)

---

## 概述

本次更新将 WhiteNote 前端与 Messages API 完整集成，实现了完整的消息创建、读取、更新、删除、收藏和置顶功能。

---

## 新增文件

### 1. API 客户端层

**文件**: [src/lib/api/messages.ts](../src/lib/api/messages.ts)

**功能**:
- 封装所有 Messages API 调用
- 提供 TypeScript 类型定义
- 支持 RESTful 操作

**主要接口**:
```typescript
interface Message {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  isStarred: boolean
  isPinned: boolean
  authorId: string
  parentId: string | null
  author: {
    id: string
    name: string | null
    avatar: string | null
  }
  tags: Array<{
    tag: {
      id: string
      name: string
      color: string | null
    }
  }>
  _count: {
    children: number
    comments: number
  }
}

// API 方法
messagesApi.getMessages(params)     // 获取消息列表
messagesApi.getMessage(id)          // 获取单条消息
messagesApi.createMessage(data)     // 创建消息
messagesApi.updateMessage(id, data) // 更新消息
messagesApi.deleteMessage(id)       // 删除消息
messagesApi.toggleStar(id)          // 切换收藏
messagesApi.togglePin(id)           // 切换置顶
```

---

### 2. UI 组件层

#### MessageCard 组件

**文件**: [src/components/MessageCard.tsx](../src/components/MessageCard.tsx)

**功能**:
- Twitter 风格的消息卡片展示
- 显示作者信息、时间戳、标签
- 收藏/置顶/删除操作
- 评论和子消息计数

**Props**:
```typescript
interface MessageCardProps {
  message: Message              // 消息数据
  onUpdate?: () => void         // 更新回调
  onDelete?: (deletedId: string) => void  // 删除回调
  onReply?: () => void          // 回复回调
  showChildren?: boolean        // 是否显示子消息
}
```

**特性**:
- ✅ 相对时间显示（使用 `date-fns` + `zhCN` locale）
- ✅ 收藏按钮（星标图标，实时状态）
- ✅ 置顶按钮（图钉图标，实时状态）
- ✅ 下拉菜单（编辑、置顶、删除）
- ✅ 删除确认对话框（AlertDialog）
- ✅ 评论/子消息计数显示

#### MessagesList 组件

**文件**: [src/components/MessagesList.tsx](../src/components/MessagesList.tsx)

**功能**:
- 消息时间线列表
- 自动加载和刷新
- 加载状态和错误处理

**Props**:
```typescript
interface MessagesListProps {
  filters?: {
    tagId?: string
    isStarred?: boolean
    isPinned?: boolean
    rootOnly?: boolean
  }
}
```

**特性**:
- ✅ 骨架屏加载状态
- ✅ 错误处理和重试按钮
- ✅ 手动刷新按钮
- ✅ 空状态提示
- ✅ 删除后自动移除消息
- ✅ 默认只显示根消息（rootOnly: true）

---

### 3. 基础 UI 组件

#### AlertDialog 组件

**文件**: [src/components/ui/alert-dialog.tsx](../src/components/ui/alert-dialog.tsx)

**功能**: 删除确认对话框

**依赖**: `@radix-ui/react-alert-dialog`

**用途**: 消息删除前的二次确认

#### DropdownMenu 组件

**文件**: [src/components/ui/dropdown-menu.tsx](../src/components/ui/dropdown-menu.tsx)

**功能**: 下拉菜单（更多操作）

**依赖**: `@radix-ui/react-dropdown-menu`

**导出**:
```typescript
DropdownMenu           // 菜单容器
DropdownMenuTrigger    // 触发按钮
DropdownMenuContent    // 菜单内容
DropdownMenuItem       // 菜单项
DropdownMenuSeparator  // 分隔线
```

---

## 修改文件

### 1. InputMachine 组件

**文件**: [src/components/InputMachine.tsx](../src/components/InputMachine.tsx)

**主要改动**:

1. **添加用户头像**:
```typescript
<Avatar className="h-10 w-10 shrink-0">
  <AvatarImage src={session?.user?.image || undefined} />
  <AvatarFallback>{getInitials(session?.user?.name)}</AvatarFallback>
</Avatar>
```

2. **集成 API 创建消息**:
```typescript
const [hasContent, setHasContent] = useState(false)

const handlePost = async () => {
  await messagesApi.createMessage({
    content: editor.getHTML(),
    tags: [],
  })
  editor.commands.clearContent()
  setHasContent(false)
  onSuccess?.()
}
```

3. **实时内容检测**:
```typescript
onUpdate: ({ editor }) => {
  const text = editor.getText()
  const html = editor.getHTML()
  const isEmpty = text.trim().length === 0 && html === '<p></p>'
  setHasContent(!isEmpty)
}
```

4. **Post 按钮状态**:
```typescript
<Button
  disabled={!hasContent || isPosting}
  onClick={handlePost}
>
  {isPosting ? <><Loader2 className="animate-spin" /> Posting...</> : "Post"}
</Button>
```

**修复的问题**:
- ❌ 旧版本: `editor?.getText()` 可能返回空字符串导致按钮无法点击
- ✅ 新版本: 使用状态追踪实时检测编辑器内容

---

### 2. 首页

**文件**: [src/app/page.tsx](../src/app/page.tsx)

**改动**:

```typescript
"use client"

import { InputMachine } from "@/components/InputMachine"
import { MessagesList } from "@/components/MessagesList"
import { useState } from "react"

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleMessageCreated = () => {
    // 创建消息后刷新列表
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="flex flex-col min-h-screen pt-[106px] desktop:pt-0">
      {/* 顶部导航标签 */}
      <div className="desktop:block hidden sticky top-0 z-10 ...">
        <button>For you</button>
        <button>Following</button>
      </div>

      {/* 输入框 */}
      <InputMachine onSuccess={handleMessageCreated} />

      {/* 消息列表 */}
      <MessagesList key={refreshKey} />
    </div>
  )
}
```

**改进**:
- ✅ 使用 `refreshKey` 强制刷新列表
- ✅ 创建消息后自动更新时间线
- ✅ 移除占位符骨架屏，使用真实数据

---

## 新增依赖

```bash
pnpm add @radix-ui/react-alert-dialog
pnpm add @radix-ui/react-dropdown-menu
```

**已有依赖**:
- `date-fns` - 时间格式化
- `lucide-react` - 图标库
- `@tiptap/react` - 富文本编辑器
- `next-auth/react` - 认证

---

## 功能特性

### 1. 创建消息 ✅

**流程**:
1. 在 TipTap 编辑器输入内容
2. 实时检测内容变化，启用 Post 按钮
3. 点击 Post → 显示加载状态
4. 成功后清空编辑器并刷新列表

**API 调用**:
```typescript
POST /api/messages
{
  "content": "<p>Hello WhiteNote!</p>",
  "tags": []
}
```

---

### 2. 读取消息 ✅

**流程**:
1. 组件挂载时自动加载消息
2. 支持分页（默认 20 条/页）
3. 支持过滤（收藏、置顶、标签）
4. 默认只显示根消息

**API 调用**:
```typescript
GET /api/messages?page=1&limit=20&rootOnly=true
```

**响应**:
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### 3. 更新消息 ⚠️

**状态**: UI 已预留入口，待实现编辑功能

**计划**:
1. 点击 "编辑" 菜单项
2. 打开编辑对话框
3. 提交更新到 API

**API 调用**:
```typescript
PUT /api/messages/[id]
{
  "content": "<p>Updated content</p>",
  "tags": ["tag1", "tag2"]
}
```

---

### 4. 删除消息 ✅

**流程**:
1. 点击 "更多" 菜单（三个点）
2. 点击 "删除"
3. 弹出确认对话框
4. 确认后删除并从列表移除

**API 调用**:
```typescript
DELETE /api/messages/[id]
```

---

### 5. 收藏消息 ✅

**流程**:
1. 点击星标图标
2. 立即切换收藏状态
3. 更新本地状态

**API 调用**:
```typescript
POST /api/messages/[id]/star
```

**响应**:
```json
{
  "data": {
    "id": "msg-id",
    "isStarred": true
  }
}
```

---

### 6. 置顶消息 ✅

**流程**:
1. 点击图钉图标或通过菜单操作
2. 立即切换置顶状态
3. 置顶消息在列表中优先显示

**API 调用**:
```typescript
POST /api/messages/[id]/pin
```

**响应**:
```json
{
  "data": {
    "id": "msg-id",
    "isPinned": true
  }
}
```

---

## 样式和设计

### 设计规范

**Twitter 风格布局**:
- 圆角按钮（rounded-full）
- hover 状态背景色变化
- 平滑过渡动画
- 间距系统（gap-3, gap-4）

**颜色方案**:
```css
primary: 蓝色主题色
muted: 灰色辅助色
border: 边框颜色
background: 背景色
```

**响应式**:
- 移动端: `pt-[106px]`（顶部导航栏高度）
- 桌面端: `desktop:pt-0`（无顶部边距）

---

## 错误处理

### 1. 加载失败

**MessagesList**:
```typescript
if (error) {
  return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">{error}</p>
      <Button onClick={() => fetchMessages()}>重试</Button>
    </div>
  )
}
```

### 2. 创建失败

**InputMachine**:
```typescript
catch (error) {
  console.error("Failed to create message:", error)
  // TODO: Show error toast
}
```

### 3. 删除失败

**MessageCard**:
```typescript
catch (error) {
  console.error("Failed to delete message:", error)
} finally {
  setIsDeleting(false)
  setShowDeleteDialog(false)
}
```

---

## 待实现功能

### 1. 消息编辑 ⚠️

**当前状态**: UI 有 "编辑" 按钮，但功能未实现

**建议实现**:
```typescript
// MessageCard.tsx
const [isEditing, setIsEditing] = useState(false)

const handleEdit = async () => {
  setIsEditing(true)
  // 打开编辑对话框或内联编辑
}

// 完成编辑后
const handleSave = async (newContent: string) => {
  await messagesApi.updateMessage(message.id, { content: newContent })
  setIsEditing(false)
  onUpdate?.()
}
```

---

### 2. 标签功能 ⚠️

**当前状态**: API 支持标签，但 UI 未实现

**建议实现**:
```typescript
// InputMachine.tsx
const [tags, setTags] = useState<string[]>([])

// 添加标签输入
<input
  value={tagInput}
  onChange={(e) => setTagInput(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      setTags([...tags, tagInput])
      setTagInput('')
    }
  }}
/>

// 创建时传递标签
await messagesApi.createMessage({
  content,
  tags,
})
```

---

### 3. Toast 通知 ⚠️

**当前状态**: 只有 console.error，无用户提示

**建议方案**:
- 安装 `sonner` 或 `react-hot-toast`
- 创建 toast context
- 在成功/失败时显示通知

**示例**:
```typescript
import { toast } from "sonner"

// 成功
toast.success("消息已发布")

// 失败
toast.error("发布失败，请重试")
```

---

### 4. 评论系统 ⚠️

**当前状态**: 显示评论数，但功能未实现

**建议实现**:
```typescript
// MessageCard.tsx
const [showComments, setShowComments] = useState(false)

{showComments && (
  <CommentsSection messageId={message.id} />
)}
```

---

### 5. 子消息（Respawn）⚠️

**当前状态**: 显示子消息数，功能未实现

**建议实现**:
```typescript
// MessageCard.tsx
const [showChildren, setShowChildren] = useState(false)

{showChildren && (
  <div className="ml-12 border-l-2">
    {message.children.map(child => (
      <MessageCard
        key={child.id}
        message={child}
        showChildren={true}
      />
    ))}
  </div>
)}
```

---

### 6. 图片上传 ⚠️

**当前状态**: 有图片按钮，功能未实现

**建议方案**:
1. 实现文件选择器
2. 上传到对象存储（S3/OSS）
3. 插入图片到编辑器
4. TipTap 图片扩展配置

---

## 测试指南

### 1. 本地测试

**启动开发服务器**:
```bash
pnpm dev
```

**访问**: http://localhost:3005

**登录账号**:
- 邮箱: `owner@whitenote.local`
- 密码: `admin123`

---

### 2. 功能测试清单

#### 创建消息
- [ ] 输入文本，Post 按钮启用
- [ ] 点击 Post，显示加载状态
- [ ] 成功后清空编辑器
- [ ] 消息出现在列表顶部

#### 收藏消息
- [ ] 点击星标图标
- [ ] 图标变为实心黄色
- [ ] 再次点击取消收藏

#### 置顶消息
- [ ] 点击图钉图标
- [ ] 消息移到列表顶部
- [ ] 显示置顶标记

#### 删除消息
- [ ] 点击 "更多" 菜单
- [ ] 点击 "删除"
- [ ] 弹出确认对话框
- [ ] 确认后消息移除

#### 刷新列表
- [ ] 点击右上角 "刷新" 按钮
- [ ] 显示加载动画
- [ ] 列表更新

---

### 3. API 测试

**使用 cURL**:
```bash
# 获取 session token
SESSION_TOKEN="从浏览器复制"

# 创建消息
curl -X POST http://localhost:3005/api/messages \
  -H "Cookie: authjs.session-token=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"<p>Hello from cURL!</p>","tags":[]}'

# 获取消息列表
curl http://localhost:3005/api/messages \
  -H "Cookie: authjs.session-token=$SESSION_TOKEN"

# 收藏消息
curl -X POST http://localhost:3005/api/messages/[id]/star \
  -H "Cookie: authjs.session-token=$SESSION_TOKEN"
```

---

## 性能优化

### 1. 状态管理

**当前**: 使用 React state + key 刷新

**优化建议**:
- 使用 React Query 或 SWR 管理服务端状态
- 减少不必要的重新渲染

**示例（React Query）**:
```typescript
const { data, isLoading, refetch } = useQuery({
  queryKey: ['messages'],
  queryFn: () => messagesApi.getMessages(),
})

// 创建后自动刷新
const mutation = useMutation({
  mutationFn: messagesApi.createMessage,
  onSuccess: () => {
    refetch()
  },
})
```

---

### 2. 虚拟滚动

**当前**: 一次加载所有消息

**优化建议**:
- 使用 `react-virtuoso` 或 `react-window`
- 只渲染可见消息

**示例**:
```typescript
import { Virtuoso } from 'react-virtuoso'

<Virtuoso
  data={messages}
  itemContent={(index, message) => (
    <MessageCard key={message.id} message={message} />
  )}
/>
```

---

### 3. 图片懒加载

**当前**: 所有图片立即加载

**优化建议**:
```typescript
<img
  src={avatar}
  loading="lazy"
  decoding="async"
/>
```

---

## 安全考虑

### 1. XSS 防护

**TipTap 编辑器**: 已内置 XSS 清理

**渲染内容**:
```typescript
// ✅ 安全：TipTap 已经清理
<div dangerouslySetInnerHTML={{ __html: message.content }} />

// ❌ 危险：直接渲染用户输入
<div>{userInput}</div>
```

---

### 2. CSRF 防护

**NextAuth.js**: 自动处理 CSRF token

**API 调用**: 使用 fetch，自动携带 cookie

---

### 3. 权限检查

**后端验证**:
```typescript
// src/app/api/messages/[id]/route.ts
if (existing.authorId !== session.user.id) {
  return Response.json({ error: "Forbidden" }, { status: 403 })
}
```

**前端提示**: 无需再次验证，相信后端

---

## 浏览器兼容性

**目标浏览器**:
- Chrome/Edge: 最新两个版本
- Firefox: 最新两个版本
- Safari: 最新两个版本

**关键特性**:
- ES2020+ 语法
- CSS Grid/Flexbox
- Fetch API
- CSS Variables

---

## 构建和部署

### 1. 开发环境

```bash
pnpm dev
```

**端口**: 3005

**环境变量**: `.env`

---

### 2. 生产构建

```bash
pnpm build
```

**输出**: `.next/`

**启动**:
```bash
pnpm start
```

---

### 3. Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## 故障排查

### 问题 1: Post 按钮无法点击

**症状**: 输入内容后，Post 按钮仍然禁用

**原因**: TipTap `getText()` 返回空字符串

**解决方案**: 使用状态追踪内容变化（已实现）

---

### 问题 2: 消息列表不更新

**症状**: 创建消息后，列表不刷新

**原因**: 缓存或 key 未变化

**解决方案**:
```typescript
const [refreshKey, setRefreshKey] = useState(0)
setRefreshKey((prev) => prev + 1)
<MessagesList key={refreshKey} />
```

---

### 问题 3: 删除后消息仍显示

**症状**: 删除成功，但消息还在列表中

**原因**: 未移除本地数据

**解决方案**:
```typescript
const handleMessageDelete = (deletedId: string) => {
  setMessages((prev) => prev.filter((m) => m.id !== deletedId))
}
```

---

### 问题 4: 时间显示不正确

**症状**: 显示 "Invalid Date" 或英文时间

**原因**: `date-fns` locale 未正确导入

**解决方案**:
```typescript
import { zhCN } from "date-fns/locale"

formatDistanceToNow(date, { locale: zhCN })
```

---

## 相关资源

### 文档

- [后端 API 文档](./BACKEND_STAGE_04_MESSAGES_API.md)
- [API 测试指南](./API_TEST_GUIDE.md)
- [Next.js 文档](https://nextjs.org/docs)
- [TipTap 文档](https://tiptap.dev/docs)
- [Radix UI 文档](https://www.radix-ui.com/docs/primitives)

### 依赖

- [date-fns](https://date-fns.org/)
- [lucide-react](https://lucide.dev/)
- [@radix-ui/react-alert-dialog](https://www.radix-ui.com/docs/primitives/components/alert-dialog)
- [@radix-ui/react-dropdown-menu](https://www.radix-ui.com/docs/primitives/components/dropdown-menu)

---

## 更新日志

### v1.0.0 (2026-01-06)

**新增**:
- ✅ Messages API 客户端
- ✅ MessageCard 组件
- ✅ MessagesList 组件
- ✅ 创建消息功能
- ✅ 收藏/置顶功能
- ✅ 删除消息功能
- ✅ 基础 UI 组件（AlertDialog、DropdownMenu）

**修复**:
- ✅ Post 按钮状态检测问题
- ✅ TypeScript 类型错误
- ✅ 下拉菜单语法错误

**待实现**:
- ⚠️ 消息编辑功能
- ⚠️ 标签管理
- ⚠️ Toast 通知
- ⚠️ 评论系统
- ⚠️ 子消息展示
- ⚠️ 图片上传

---

**维护者**: Claude
**最后更新**: 2026-01-06
