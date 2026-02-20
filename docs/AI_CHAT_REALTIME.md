# WhiteNote AI Chat - 架构说明

## 概述

WhiteNote AI Chat 是一个通过 **OpenClaw Gateway** 作为后端的 AI 对话界面。

---

## 功能

1. **流式响应** - SSE (Server-Sent Events) 实现 AI 文本输出的实时显示
2. **思考过程可视化** - 消息完成后显示 AI 的 reasoning/thinking 过程（紫色边框 + 🧠 图标）
3. **工具调用可视化** - 消息完成后显示工具执行过程（蓝色边框 + 🔧 图标）和结果（绿色边框 + → 图标）
4. **富文本渲染** - 基于 TipTap 的 Markdown 渲染，支持代码高亮
5. **消息持久化** - localStorage 保存聊天历史，刷新后自动恢复
6. **移动端适配** - 检测键盘状态，动态调整布局

### 页面访问

```
http://localhost:3005/aichat
```

---

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        WhiteNote 前端                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐      │
│  │ aichat/      │  │ ChatWindow.tsx   │  │ AIMessage    │      │
│  │ page.tsx     │◄─┤ (SSE 流式)        │◄─┤ Viewer.tsx   │      │
│  └──────────────┘  └──────────────────┘  └──────────────┘      │
│         │                   │                                   │
│         ▼                   ▼                                   │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ api.ts       │    │ SSE 流式     │                          │
│  │ (历史获取)   │    │ (文本流)     │                          │
│  └──────┬───────┘    └──────┬───────┘                          │
└─────────┼───────────────────┼───────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API 层                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │ /api/openclaw/chat/    │  │ /api/openclaw/chat/    │       │
│  │ stream/route.ts        │  │ history/route.ts       │       │
│  │ (SSE 转发)             │  │ (获取历史/完整消息)    │       │
│  └───────────┬────────────┘  └───────────┬────────────┘       │
│              │                           │                     │
│              └───────────┬───────────────┘                     │
│                          ▼                                      │
│  ┌─────────────────────────────────────────┐                   │
│  │ lib/openclaw/gateway.ts                 │                   │
│  │ (WebSocket 客户端)                      │                   │
│  └─────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   OpenClaw Gateway (外部服务)                    │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket: ws://localhost:18789                                │
│                                                                 │
│  实时发送:                                                       │
│  - lifecycle (开始/结束) ✅                                      │
│  - assistant (文本流) ✅                                         │
│                                                                 │
│  完成后获取 (通过 history API):                                  │
│  - thinking (思考过程)                                           │
│  - toolCall (工具调用)                                           │
│  - toolResult (工具结果)                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 数据流

### 1. 发送消息时

```
用户输入 → ChatWindow.tsx → api.ts → /api/openclaw/chat/stream → OpenClaw Gateway
```

### 2. 接收流式响应

```
OpenClaw Gateway → SSE 事件 (assistant 文本流) → ChatWindow.tsx → 实时更新 UI
```

### 3. 消息完成后

```
流结束 → 调用 getAssistantMessages() → 获取完整消息（含 thinking/toolCall）→ 更新 UI
```

---

## 涉及的文件

### 前端文件

| 文件 | 说明 |
|------|------|
| `src/app/aichat/page.tsx` | AI Chat 页面入口 |
| `src/components/OpenClawChat/ChatWindow.tsx` | 主聊天组件，SSE 流式处理 |
| `src/components/OpenClawChat/AIMessageViewer.tsx` | 消息渲染器，显示 thinking/toolCall |
| `src/components/OpenClawChat/api.ts` | 前端 API 客户端 |
| `src/components/OpenClawChat/types.ts` | 前端类型定义 |

### 后端文件

| 文件 | 说明 |
|------|------|
| `src/app/api/openclaw/chat/stream/route.ts` | SSE 流式聊天 API |
| `src/app/api/openclaw/chat/history/route.ts` | 获取聊天历史 API |
| `src/lib/openclaw/gateway.ts` | WebSocket 客户端 |
| `src/lib/openclaw/types.ts` | OpenClaw 协议类型定义 |

---

## 配置

在 `.env.local` 中添加：

```env
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_TOKEN=your-token-here
```

---

## 更新日志

- **2026-02-20**: 简化架构，移除轮询机制，只在流结束时获取 thinking/toolCall
- **2026-02-19**: 初始版本，包含轮询机制
