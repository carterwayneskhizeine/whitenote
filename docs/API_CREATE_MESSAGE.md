# WhiteNote 发帖 API 使用指南

## 概述

本文档说明如何通过命令行/HTTP API 向 WhiteNote 发布消息。

## API 端点

```
POST /api/messages
```

## 认证方式

WhiteNote 使用 NextAuth.js 的 JWT session 认证。需要在请求头中携带有效的 session cookie。

### 获取 Session Cookie

**方法一：浏览器开发者工具（推荐）**

1. 在浏览器中登录 WhiteNote
2. 打开开发者工具 (F12)
3. 进入 Application/Storage → Cookies → localhost
4. 复制 `__Secure-next-auth.session-token` 或 `next-auth.session-token` 的值

**方法二：登录 API**

```bash
curl -X POST http://localhost:3005/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }' \
  -c cookies.txt
```

## 请求格式

### 请求头

```http
Content-Type: application/json
Cookie: next-auth.session-token=<YOUR_SESSION_TOKEN>
```

### 请求体 (JSON)

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `content` | string | 是* | 消息内容（支持 TipTap 富文本格式）。如果没有提供 `media` 则必需 |
| `title` | string | 否 | 消息标题 |
| `tags` | string[] | 否 | 标签数组，如 `["AI", "笔记"]` |
| `quotedMessageId` | string | 否 | 引用的消息 ID（用于引用转发） |
| `quotedCommentId` | string | 否 | 引用的评论 ID（用于引用转发评论） |
| `media` | object[] | 否 | 媒体文件数组 |
| `media[].url` | string | 是 | 媒体文件的 URL |
| `media[].type` | string | 是 | 媒体类型：`IMAGE` 或 `VIDEO` |
| `workspaceId` | string | 否 | 目标工作区 ID。不提供则使用默认工作区 |

* `content` 和 `media` 至少需要提供一个

## 获取工作区列表

在使用 `workspaceId` 之前，你需要先获取你的工作区列表和对应的 ID。

### API 端点

```
GET /api/workspaces
```

### 请求示例

```bash
curl -X GET http://localhost:3005/api/workspaces \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE"
```

### 响应格式

```json
{
  "data": [
    {
      "id": "cm4abc123",
      "name": "默认",
      "description": null,
      "isDefault": true,
      "userId": "user_id_here",
      "ragflowDatasetId": "dataset_xxx",
      "ragflowChatId": "chat_yyy",
      "enableAutoTag": true,
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-10T08:00:00.000Z"
    },
    {
      "id": "cm4def456",
      "name": "工作项目",
      "description": "项目相关笔记",
      "isDefault": false,
      "userId": "user_id_here",
      "ragflowDatasetId": "dataset_zzz",
      "ragflowChatId": "chat_www",
      "enableAutoTag": false,
      "createdAt": "2025-01-12T10:30:00.000Z",
      "updatedAt": "2025-01-12T10:30:00.000Z"
    }
  ]
}
```

### 快速获取默认工作区 ID

使用 `jq` 快速提取默认工作区 ID：

```bash
curl -s -X GET http://localhost:3005/api/workspaces \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  | jq -r '.data[] | select(.isDefault == true) | .id'
```

### 获取所有工作区名称和 ID

```bash
curl -s -X GET http://localhost:3005/api/workspaces \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  | jq -r '.data[] | "\(.name): \(.id)"'
```

输出示例：
```
默认: cm4abc123
工作项目: cm4def456
学习笔记: cm4ghi789
```

## 使用示例

### 基础文本消息

```bash
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "content": "这是一条测试消息"
  }'
```

### 带标题和标签的消息

```bash
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "title": "API 测试",
    "content": "通过 API 发布的消息，支持标签功能",
    "tags": ["API", "测试", "自动化"]
  }'
```

### 引用其他消息（Quote/转发）

```bash
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "content": "我对这条消息的看法...",
    "quotedMessageId": "MESSAGE_ID_HERE"
  }'
```

### 带媒体文件的消息

```bash
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "content": "看看这张图片",
    "media": [
      {
        "url": "https://example.com/image.jpg",
        "type": "IMAGE"
      }
    ]
  }'
```

### 指定工作区

```bash
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN_HERE" \
  -d '{
    "content": "发送到特定工作区的消息",
    "workspaceId": "WORKSPACE_ID_HERE"
  }'
```

## 响应格式

### 成功响应 (201 Created)

```json
{
  "data": {
    "id": "cm4xxxxx",
    "title": "API 测试",
    "content": "这是消息内容",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "author": {
      "id": "user_id",
      "name": "用户名",
      "avatar": null,
      "email": "user@example.com"
    },
    "tags": [
      {
        "tag": {
          "id": "tag_id",
          "name": "API",
          "color": "#3B82F6"
        }
      }
    ],
    "medias": [],
    "quotedMessage": null,
    "quotedComment": null,
    "retweetCount": 0,
    "isRetweeted": false,
    "_count": {
      "comments": 0,
      "retweets": 0
    }
  }
}
```

### 错误响应

**401 Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request**
```json
{
  "error": "Content or media is required"
}
```

**404 Not Found**
```json
{
  "error": "Workspace not found"
}
```

## 高级功能

### 自动标签处理

如果工作区启用了自动标签 (`enableAutoTag`)，消息创建后会自动触发 AI 打标签任务。

### RAGFlow 同步

消息创建后会自动同步到 RAGFlow 知识库（如果工作区已配置）。

### Markdown 文件同步

如果在 AI 设置中启用了 Markdown 同步 (`enableMdSync`)，消息会自动同步到本地文件系统。

## 完整示例脚本

### 基础发帖脚本

```bash
#!/bin/bash

# 配置
API_URL="http://localhost:3005/api/messages"
SESSION_TOKEN="YOUR_SESSION_TOKEN_HERE"

# 发帖函数
post_message() {
  local content="$1"
  local title="$2"
  local tags="$3"

  curl -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
    -d "{
      \"title\": \"$title\",
      \"content\": \"$content\",
      \"tags\": $tags
    }"
}

# 使用示例
post_message \
  "这是通过 API 自动发布的消息" \
  "自动化测试" \
  '["API", "自动化"]'
```

### 完整流程：获取工作区并指定工作区发帖

```bash
#!/bin/bash

# 配置
BASE_URL="http://localhost:3005"
SESSION_TOKEN="YOUR_SESSION_TOKEN_HERE"

# 1. 获取工作区列表并让用户选择
echo "正在获取工作区列表..."
WORKSPACES=$(curl -s -X GET "$BASE_URL/api/workspaces" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN")

# 显示工作区列表（需要安装 jq）
echo "你的工作区："
echo "$WORKSPACES" | jq -r '.data[] | "\(.id) | \(.name) | \(.description // "无描述")"'

# 2. 获取默认工作区 ID（或让用户选择）
DEFAULT_WORKSPACE_ID=$(echo "$WORKSPACES" | jq -r '.data[] | select(.isDefault == true) | .id')

# 或者让用户输入工作区 ID
read -p "输入工作区 ID (直接回车使用默认: $DEFAULT_WORKSPACE_ID): " WORKSPACE_ID
WORKSPACE_ID=${WORKSPACE_ID:-$DEFAULT_WORKSPACE_ID}

# 3. 发帖到指定工作区
curl -X POST "$BASE_URL/api/messages" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
  -d "{
    \"content\": \"发送到工作区的测试消息\",
    \"workspaceId\": \"$WORKSPACE_ID\"
  }"

echo ""
echo "消息已发送到工作区 ID: $WORKSPACE_ID"
```

## 注意事项

1. **Session 有效期**: Session token 可能会过期，过期后需要重新登录
2. **工作区权限**: 只能向属于当前用户的工作区发帖
3. **媒体上传**: 媒体文件需要先通过 `/api/upload` 上传获取 URL
4. **内容格式**: `content` 支持 TipTap JSON 格式，可用于富文本内容
5. **异步处理**: AI 标签和 RAGFlow 同步是异步进行的，不会阻塞响应
