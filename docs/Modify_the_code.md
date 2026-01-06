开始根据要求修改代码

### 📝 消息 (`/api/messages`)
- `PUT /api/messages/[id]`：更新消息内容           把 AI 给消息打的标签放在头像和用户名的后面 像这样 Owner @owner·大约 3 小时前   #AI #科技 ，可以手动编辑标签并同步到数据库 标签使用#开头比如 #AI #科技 可以有多个标签，如果用户名哪一排放不下多个标签就在用户名下面另起一行放标签 
- `POST /api/messages/[id]/star`：切换星标状态  把星标换成收藏图标，然后 LeftSidebar 的收藏页面现在还没有，把收藏的帖子放在你将要创建的 收藏页面 。

### 🏷️ 标签 (`/api/tags`)       现在 标签 使用的是 LeftSidebar 的探索页面，修改探索页面的名称和图标为 Tags ，然后现在没有使用 AI 给消息打标签，现在的标签都是预设的，不知道有没有给消息打标签的 AI worker 
- `GET /api/tags`：列出所有标签及使用次数  
- `POST /api/tags`：创建新标签  
- `GET /api/tags/[id]/messages`：按标签过滤消息

### 📄 模板 (`/api/templates`)
- `GET /api/templates`：列出可用模板（内置 + 用户自定义）  
- `POST /api/templates`：创建自定义模板         现在没有创建自定义模板的界面
- `GET /api/templates/[id]`：获取模板详情  
- `DELETE /api/templates/[id]`：删除自定义模板        也没有删除自定义模板的界面

### 🏗️ 后台任务   现在好像没有使用 AI 给消息打标签，现在的标签都是预设的，不知道有没有给消息打标签的 AI worker 
- **队列系统**：BullMQ + Redis（`src/lib/queue`）  
- **处理器**：自动打标签、每日简报、RAGFlow 同步

## 2. 缺失 / 待实现的 API（⚠️ 需补充）

为达到与《产品设计 v2.5》的 100% 功能对等，并完整支持前端，需实现以下 API。

### 📡 实时同步（阶段 8）
*用途：多设备同步、类 Google Docs 的协同编辑*  
- **状态**：❌ 代码缺失  
- **需新建文件**：
  - `src/lib/socket/server.ts`：Socket.io 服务器实例  
  - `src/app/api/socket/route.ts`：Next.js 路由占位  
  - 自定义服务器入口 (`server.ts`)：将 Socket.io 挂载到 HTTP 服务器

### 🕸️ 知识图谱
*用途：前端「图谱视图」*  
- **状态**：❌ 未开始  
- **端点**：`GET /api/graph`（或 `/api/graph/nodes`）  
- **逻辑**：返回节点（消息/标签）与边（链接），供 D3.js / 力导向图使用

### 🔔 通知
*用途：左侧栏「通知」*  
- **状态**：❌ 未开始  
- **端点**：`GET /api/notifications`  
- **逻辑**：获取系统提醒、互动通知、提醒事项

### ⏰ 提醒
*用途：产品设计中的提醒系统*  
- **状态**：❌ 未开始  
- **端点**：`POST /api/reminders`、`GET /api/reminders`  
- **逻辑**：为消息创建定时提醒

### 📂 媒体 / 文件上传
*用途：图片上传*  
- **状态**：❌ 未开始  
- **端点**：`POST /api/upload`  
- **逻辑**：处理文件上传（本地或 S3/OSS）并返回 URL

### 🔄 导入 / 导出
*用途：备份*  
- **状态**：❌ 未开始  
- **端点**：`GET /api/export`  
- **逻辑**：生成用户数据的 Markdown / JSON 导出包


✦ 好的，我将按照您的要求，分步骤修改代码以满足新的需求。

  我们将分以下几个阶段进行：
   1. 导航与页面调整：修改侧边栏（Tags, Favorites），创建收藏页面。
   2. 消息卡片升级：调整头部布局（标签换行），更换收藏图标，支持编辑同步。
   3. 模板管理界面：新增模板管理页面（增删查）。
   4. AI Worker 检查与集成：确保消息发布后触发 AI 打标。
   5. 实时同步 (Stage 8)：这是最大的缺失模块，我们将搭建 Socket 服务。

  ---

  第一步：导航与页面调整

  修改点：
   1. LeftSidebar: "Explore" -> "Tags" (图标变更为 Hash)，新增 "Favorites" (图标 Bookmark)。
   2. 创建 /app/favorites/page.tsx。
   3. 创建 /app/tags/page.tsx (原 Explore)。

  1. 修改 src/components/layout/LeftSidebar.tsx

    1 "use client"
    2
    3 import { cn } from "@/lib/utils"
    4 import { Button } from "@/components/ui/button"
    5 import {
    6   Home,
    7   Hash, // 替换 Search/Globe 为 Hash
    8   Bell,
    9   Bookmark, // 新增 Bookmark
   10   Settings,
   11   Feather,
   12   User,
   13   MoreHorizontal
   14 } from "lucide-react" // 确保安装了 lucide-react
   15 import Link from "next/link"
   16 import { usePathname } from "next/navigation"
   17
   18 // ... 保持其他 import
   19
   20 export function LeftSidebar() {
   21   const pathname = usePathname()
   22
   23   const navItems = [
   24     { icon: Home, label: "Home", href: "/" },
   25     { icon: Hash, label: "Tags", href: "/tags" }, // 修改 Explore 为 Tags
   26     { icon: Bell, label: "Notifications", href: "/notifications" },
   27     { icon: Bookmark, label: "Favorites", href: "/favorites" }, // 新增 Favorites
   28     { icon: Settings, label: "Settings", href: "/settings" },
   29   ]
   30
   31   // ... 保持其余代码不变
   32 }

  2. 创建收藏页面 src/app/favorites/page.tsx

    1 "use client"
    2
    3 import { MessagesList } from "@/components/MessagesList"
    4 import { MainLayout } from "@/components/layout/MainLayout"
    5
    6 export default function FavoritesPage() {
    7   return (
    8     <MainLayout>
    9       <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b p-4">
   10         <h1 className="text-xl font-bold">Favorites</h1>
   11       </div>
   12       <MessagesList filters={{ isStarred: true }} />
   13     </MainLayout>
   14   )
   15 }

  3. 调整 Tags 页面 src/app/explore/page.tsx -> src/app/tags/page.tsx

  请将原 src/app/explore 文件夹重命名为 src/app/tags，并确保内容逻辑是展示标签列表。

  ---

  第二步：消息卡片升级 (UI & 逻辑)

  修改点：
   1. Header: 标签显示在用户名后，支持换行。
   2. Icon: Star -> Bookmark。
   3. Edit: 编辑时解析内容中的 Hashtag 并同步。

  修改 src/components/MessageCard.tsx

     1 "use client"
     2
     3 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
     4 import { Button } from "@/components/ui/button"
     5 import {
     6   MessageCircle,
     7   Repeat2,
     8   Bookmark, // 替换 Star
     9   BookmarkCheck, // 选中状态
    10   MoreHorizontal,
    11   Trash2,
    12   Pin,
    13   Pencil
    14 } from "lucide-react"
    15 import { formatDistanceToNow } from "date-fns"
    16 import { zhCN } from "date-fns/locale"
    17 import { useState } from "react"
    18 import { messagesApi } from "@/lib/api/messages"
    19 import {
    20   DropdownMenu,
    21   DropdownMenuContent,
    22   DropdownMenuItem,
    23   DropdownMenuTrigger,
    24 } from "@/components/ui/dropdown-menu"
    25 import {
    26   AlertDialog,
    27   AlertDialogAction,
    28   AlertDialogCancel,
    29   AlertDialogContent,
    30   AlertDialogDescription,
    31   AlertDialogFooter,
    32   AlertDialogHeader,
    33   AlertDialogTitle,
    34 } from "@/components/ui/alert-dialog"
    35 // 引入 Tiptap 相关组件用于编辑模式 (假设你有 Editor 组件，这里简化为 textarea 示例，建议复用
       InputMachine 逻辑)
    36 import { Textarea } from "@/components/ui/textarea"
    37
    38 // ... 接口定义保持不变
    39
    40 export function MessageCard({ message, onUpdate, onDelete }: MessageCardProps) {
    41   const [isStarred, setIsStarred] = useState(message.isStarred)
    42   const [isEditing, setIsEditing] = useState(false)
    43   const [editContent, setEditContent] = useState(message.content)
    44   const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    45
    46   // 提取标签的辅助函数 (简单正则)
    47   const extractTags = (text: string) => {
    48     const matches = text.match(/#[\w\u4e00-\u9fa5]+/g)
    49     return matches ? matches.map(t => t.slice(1)) : []
    50   }
    51
    52   // 处理收藏 (Bookmark)
    53   const handleToggleStar = async () => {
    54     try {
    55       setIsStarred(!isStarred)
    56       await messagesApi.toggleStar(message.id)
    57     } catch (error) {
    58       setIsStarred(message.isStarred) // 回滚
    59       console.error("Failed to toggle star", error)
    60     }
    61   }
    62
    63   // 处理更新
    64   const handleSaveEdit = async () => {
    65     try {
    66       // 自动从内容中提取标签
    67       const tags = extractTags(editContent)
    68
    69       await messagesApi.updateMessage(message.id, {
    70         content: editContent,
    71         tags: tags // 同步标签到数据库
    72       })
    73
    74       setIsEditing(false)
    75       onUpdate?.() // 刷新列表
    76     } catch (error) {
    77       console.error("Failed to update message", error)
    78     }
    79   }
    80
    81   return (
    82     <div className="flex gap-3 p-4 border-b border-border hover:bg-secondary/20 transition-colors">
    83       <Avatar className="h-10 w-10 shrink-0 cursor-pointer">
    84         <AvatarImage src={message.author.avatar || undefined} />
    85         <AvatarFallback>{message.author.name?.[0] || "U"}</AvatarFallback>
    86       </Avatar>
    87
    88       <div className="flex-1 min-w-0">
    89         {/* Header: User Info + Tags */}
    90         <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
    91           <span className="font-bold hover:underline cursor-pointer">
    92             {message.author.name}
    93           </span>
    94           <span className="text-muted-foreground text-sm">
    95             @{message.author.email?.split('@')[0]} · {formatDistanceToNow(new Date(message.createdAt),
       locale: zhCN, addSuffix: true })}
    96           </span>
    97
    98           {/* Tags Display (Wrap if needed) */}
    99           <div className="flex flex-wrap gap-1">
   100             {message.tags.map(({ tag }) => (
   101               <span key={tag.id} className="text-primary text-sm hover:underline cursor-pointer">
   102                 #{tag.name}
   103               </span>
   104             ))}
   105           </div>
   106         </div>
   107
   108         {/* Content Area */}
   109         {isEditing ? (
   110           <div className="space-y-2">
   111             <Textarea
   112               value={editContent}
   113               onChange={(e) => setEditContent(e.target.value)}
   114               className="min-h-[100px]"
   115             />
   116             <div className="flex gap-2 justify-end">
   117               <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
   118               <Button size="sm" onClick={handleSaveEdit}>Save</Button>
   119             </div>
   120           </div>
   121         ) : (
   122           <div
   123             className="text-[15px] whitespace-pre-wrap break-words"
   124             dangerouslySetInnerHTML={{ __html: message.content }}
   125           />
   126         )}
   127
   128         {/* Footer Actions */}
   129         <div className="flex justify-between mt-3 max-w-md text-muted-foreground">
   130           <Button variant="ghost" size="icon" className="hover:text-primary">
   131             <MessageCircle className="h-4 w-4" />
   132             {message._count.comments > 0 && <span className="ml-1 text-xs">{message._count.comments}</
       span>}
   133           </Button>
   134
   135           <Button variant="ghost" size="icon" className="hover:text-green-500">
   136             <Repeat2 className="h-4 w-4" />
   137           </Button>
   138
   139           <Button
   140             variant="ghost"
   141             size="icon"
   142             className={isStarred ? "text-yellow-500 hover:text-yellow-600" : "hover:text-yellow-500"}
   143             onClick={handleToggleStar}
   144           >
   145             {isStarred ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4
       w-4" />}
   146           </Button>
   147
   148           <DropdownMenu>
   149             <DropdownMenuTrigger asChild>
   150               <Button variant="ghost" size="icon">
   151                 <MoreHorizontal className="h-4 w-4" />
   152               </Button>
   153             </DropdownMenuTrigger>
   154             <DropdownMenuContent align="end">
   155               <DropdownMenuItem onClick={() => setIsEditing(true)}>
   156                 <Pencil className="mr-2 h-4 w-4" /> Edit
   157               </DropdownMenuItem>
   158               <DropdownMenuItem onClick={() => messagesApi.togglePin(message.id)}>
   159                 <Pin className="mr-2 h-4 w-4" /> {message.isPinned ? "Unpin" : "Pin"}
   160               </DropdownMenuItem>
   161               <DropdownMenuItem className="text-red-600" onClick={() => setShowDeleteDialog(true)}>
   162                 <Trash2 className="mr-2 h-4 w-4" /> Delete
   163               </DropdownMenuItem>
   164             </DropdownMenuContent>
   165           </DropdownMenu>
   166         </div>
   167       </div>
   168
   169       <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
   170         <AlertDialogContent>
   171           <AlertDialogHeader>
   172             <AlertDialogTitle>Delete Message?</AlertDialogTitle>
   173             <AlertDialogDescription>
   174               This action cannot be undone.
   175             </AlertDialogDescription>
   176           </AlertDialogHeader>
   177           <AlertDialogFooter>
   178             <AlertDialogCancel>Cancel</AlertDialogCancel>
   179             <AlertDialogAction
   180               className="bg-red-600 hover:bg-red-700"
   181               onClick={async () => {
   182                 await onDelete?.(message.id)
   183                 setShowDeleteDialog(false)
   184               }}
   185             >
   186               Delete
   187             </AlertDialogAction>
   188           </AlertDialogFooter>
   189         </AlertDialogContent>
   190       </AlertDialog>
   191     </div>
   192   )
   193 }

  ---

  第三步：模板管理界面

  修改点：
   1. 新建 src/app/templates/page.tsx 实现模板的 CRUD。
     1 "use client"
     2
     3 import { MainLayout } from "@/components/layout/MainLayout"
     4 import { Button } from "@/components/ui/button"
     5 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
     6 import { Input } from "@/components/ui/input"
     7 import { Textarea } from "@/components/ui/textarea"
     8 import { useState, useEffect } from "react"
     9 import { Plus, Trash2 } from "lucide-react"
    10
    11 interface Template {
    12   id: string
    13   name: string
    14   content: string
    15   description: string | null
    16   isBuiltIn: boolean
    17 }
    18
    19 export default function TemplatesPage() {
    20   const [templates, setTemplates] = useState<Template[]>([])
    21   const [isCreating, setIsCreating] = useState(false)
    22   const [newTemplate, setNewTemplate] = useState({ name: "", content: "", description: "" })
    23
    24   useEffect(() => {
    25     fetchTemplates()
    26   }, [])
    27
    28   const fetchTemplates = async () => {
    29     const res = await fetch('/api/templates')
    30     const json = await res.json()
    31     setTemplates(json.data)
    32   }
    33
    34   const handleCreate = async () => {
    35     if (!newTemplate.name || !newTemplate.content) return
    36     await fetch('/api/templates', {
    37       method: 'POST',
    38       body: JSON.stringify(newTemplate)
    39     })
    40     setIsCreating(false)
    41     setNewTemplate({ name: "", content: "", description: "" })
    42     fetchTemplates()
    43   }
    44
    45   const handleDelete = async (id: string) => {
    46     await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    47     fetchTemplates()
    48   }
    49
    50   return (
    51     <MainLayout>
    52       <div className="p-4 space-y-4">
    53         <div className="flex justify-between items-center">
    54           <h1 className="text-xl font-bold">Templates</h1>
    55           <Button onClick={() => setIsCreating(!isCreating)}>
    56             <Plus className="w-4 h-4 mr-2" /> New Template
    57           </Button>
    58         </div>
    59
    60         {isCreating && (
    61           <Card className="border-dashed">
    62             <CardHeader><CardTitle>Create Template</CardTitle></CardHeader>
    63             <CardContent className="space-y-3">
    64               <Input
    65                 placeholder="Template Name"
    66                 value={newTemplate.name}
    67                 onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
    68               />
    69               <Input
    70                 placeholder="Description (Optional)"
    71                 value={newTemplate.description}
    72                 onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
    73               />
    74               <Textarea
    75                 placeholder="Content..."
    76                 value={newTemplate.content}
    77                 onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
    78               />
    79               <div className="flex justify-end gap-2">
    80                 <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
    81                 <Button onClick={handleCreate}>Save</Button>
    82               </div>
    83             </CardContent>
    84           </Card>
    85         )}
    86
    87         <div className="grid gap-4">
    88           {templates.map(t => (
    89             <Card key={t.id}>
    90               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    91                 <CardTitle className="text-base font-medium">
    92                   {t.name}
    93                   {t.isBuiltIn && <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded">Syste
       </span>}
    94                 </CardTitle>
    95                 {!t.isBuiltIn && (
    96                   <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
    97                     <Trash2 className="w-4 h-4 text-red-500" />
    98                   </Button>
    99                 )}
   100               </CardHeader>
   101               <CardContent>
   102                 <p className="text-sm text-muted-foreground mb-2">{t.description}</p>
   103                 <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
   104                   {t.content}
   105                 </pre>
   106               </CardContent>
   107             </Card>
   108           ))}
   109         </div>
   110       </div>
   111     </MainLayout>
   112   )
   113 }

  ---

  第四步：AI Worker 检查 (确保打标功能)

  您担心 AI 自动打标没有工作。请检查以下文件确保连接正确。

  检查文件 `src/app/api/messages/route.ts`
  确保 POST 方法中包含 addTask 调用。

    1 import { addTask } from "@/lib/queue"
    2
    3 // ... inside POST function ...
    4 // 创建消息成功后：
    5
    6 // 1. 获取 AI 配置
    7 const config = await prisma.aiConfig.findUnique({
    8   where: { userId: session.user.id }
    9 })
   10
   11 // 2. 触发任务
   12 if (config?.enableAutoTag) {
   13   // 必须确保 addTask 被调用
   14   await addTask("auto-tag", {
   15     userId: session.user.id,
   16     messageId: message.id
   17   })
   18 }

  确认 Worker 运行
  在开发时，您必须在单独的终端运行：
   1 pnpm worker
  如果不运行这个命令，AI 任务只会堆积在 Redis 队列中，不会执行。

  ---

  第五步：实时同步 (Stage 8 - 缺失模块)

  这是您项目中缺失的核心模块。

  1. 创建 Socket Server 逻辑 src/lib/socket/server.ts

    1 import { Server as SocketIOServer, Socket } from "socket.io"
    2 import { Server as HTTPServer } from "http"
    3 import { parse } from "cookie"
    4 import prisma from "@/lib/prisma" // 确保是默认导出
    5
    6 interface SocketData {
    7   userId: string
    8   messageId: string | null
    9   isEditing: boolean
   10 }
   11
   12 export function initSocketServer(httpServer: HTTPServer) {
   13   const io = new SocketIOServer(httpServer, {
   14     path: "/api/socket",
   15     cors: { origin: "*", credentials: true }, // 开发环境允许所有
   16   })
   17
   18   // 认证中间件
   19   io.use(async (socket, next) => {
   20     // 简化版认证，实际应解析 Session Token
   21     const cookies = socket.handshake.headers.cookie
   22     if (!cookies) return next(new Error("No cookies"))
   23
   24     // 这里简单通过 Mock 或 Cookie 存在性通过，生产环境需严格校验 NextAuth Token
   25     // 假设已认证，获取 userId (在真实逻辑中需要 verify JWT)
   26     // 暂时 mock:
   27     socket.data = { userId: "mock-user-id", isEditing: false }
   28     next()
   29   })
   30
   31   io.on("connection", (socket) => {
   32     console.log("Socket connected:", socket.id)
   33
   34     socket.on("edit:start", ({ messageId }) => {
   35       socket.join(`message:${messageId}`)
   36       socket.to(`message:${messageId}`).emit("user:editing", { userId: socket.data.userId })
   37     })
   38
   39     socket.on("sync:content", ({ messageId, content }) => {
   40       // 广播给房间内其他人
   41       socket.to(`message:${messageId}`).emit("sync:receive", { messageId, content })
   42     })
   43   })
   44
   45   return io
   46 }

  2. 创建 Next.js 路由占位 src/app/api/socket/route.ts

   1 export async function GET() {
   2   return new Response("Socket.io server running", { status: 200 })
   3 }

  3. 创建自定义服务器入口 server.ts (项目根目录)

    1 import { createServer } from "http"
    2 import { parse } from "url"
    3 import next from "next"
    4 import { initSocketServer } from "./src/lib/socket/server"
    5
    6 const dev = process.env.NODE_ENV !== "production"
    7 const hostname = "localhost"
    8 const port = 3005
    9
   10 const app = next({ dev, hostname, port })
   11 const handle = app.getRequestHandler()
   12
   13 app.prepare().then(() => {
   14   const httpServer = createServer((req, res) => {
   15     const parsedUrl = parse(req.url!, true)
   16     handle(req, res, parsedUrl)
   17   })
   18
   19   initSocketServer(httpServer)
   20
   21   httpServer.listen(port, () => {
   22     console.log(`> Ready on http://${hostname}:${port}`)
   23   })
   24 })

  最后，修改启动命令 (package.json)：

   1 "scripts": {
   2   "dev": "tsx server.ts",
   3   "build": "next build",
   4   "start": "NODE_ENV=production tsx server.ts"
   5 }
  (确保安装了 tsx: pnpm add -D tsx)

  ---