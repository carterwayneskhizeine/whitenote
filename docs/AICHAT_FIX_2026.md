# OpenClaw AI Chat 修复记录

> 2026-04-23 | 基于 OpenClaw Gateway v2026.4.21 (Protocol v3)

## 背景

`/aichat` 页面长期无法使用。WhiteNote 作为服务端代理连接 OpenClaw Gateway WebSocket，转发前端聊天请求。

## 问题诊断与修复

### 1. Origin 校验被拒

**现象**: `origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)`

**根因**: 旧代码使用 `client.id = 'webchat-ui'` + `client.mode = 'webchat'`，触发了 Gateway 的浏览器 Origin 校验。

Gateway 的 `isWebchatClient()` 检查两个条件（OR 关系）：
- `mode === 'webchat'`
- `id === 'webchat-ui'`

WhiteNote 是服务端到服务端通信，不应使用 webchat 模式。

**修复**: 改为 `id = 'gateway-client'` + `mode = 'backend'`，匹配上游 `GatewayClient` 的身份。

```
文件: src/lib/openclaw/gateway.ts
```

### 2. 签名协议过时 (v2 → v3)

**现象**: 连接后认证可能失败。

**根因**: 旧代码使用 v2 签名格式，上游已迁移到 v3（增加了 `platform` 和 `deviceFamily` 字段）。

**修复**: 新增 `buildDeviceAuthPayloadV3()` 函数，v3 格式：

```
v3|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{signedAtMs}|{token}|{nonce}|{platform}|{deviceFamily}
```

```
文件: src/lib/openclaw/deviceIdentity.ts
```

### 3. 单例 Gateway onEvent 竞态条件

**现象**: 并发请求时事件丢失，某些请求永远不返回。

**根因**: 旧代码通过 `gateway.onEvent = handler` 设置单一回调。多个并发 SSE 流请求会互相覆盖回调。

**修复**: 将 `OpenClawGateway` 改为继承 `EventEmitter`，通过 `on/off` 模式支持多个独立监听器。

```typescript
// 旧: 单一回调，并发请求互相覆盖
gateway.onEvent = eventHandler

// 新: EventEmitter，每个请求独立监听
gateway.on('event', eventHandler)
// ... 请求结束后
gateway.off('event', eventHandler)
```

```
文件: src/lib/openclaw/gateway.ts, src/app/api/openclaw/chat/stream/route.ts
```

### 4. chat.send 永久挂起

**现象**: 发送消息后流永远不结束。

**根因**: `chat.send` 使用了 `expectFinal: true`。Gateway 对 `chat.send` 只返回一个 `{ status: "accepted" }` 响应，不会发第二个。`expectFinal` 模式会忽略 accepted 响应并永远等待。

**修复**: 移除 `expectFinal`，`chat.send` 使用普通请求模式。聊天内容通过 `chat` 事件流异步推送。

```
文件: src/lib/openclaw/gateway.ts (sendMessage 方法)
```

### 5. 重连时握手状态未重置

**现象**: 首次连接失败后，后续所有重连都跳过握手，永远无法建立连接。

**根因**: `start()` 方法没有重置 `connectSent` 和 `connectNonce`。上次失败的 `connectSent = true` 导致重连时 `sendConnect()` 直接 return。

**修复**: 在 `start()` 开头重置握手状态：

```typescript
start(): void {
  this.connectNonce = null;
  this.connectSent = false;
  // ...
}
```

```
文件: src/lib/openclaw/gateway.ts
```

### 6. API 路由返回 503

**现象**: sessions 等路由在 Gateway 未连接时直接返回 503，而不是等待连接。

**修复**: 统一使用 `waitForConnection()` 等待连接建立，替代直接返回 503 的逻辑。

```
文件: src/app/api/openclaw/sessions/route.ts, src/app/api/openclaw/sessions/[key]/route.ts
```

### 7. 性能问题

| 问题 | 修复 |
|------|------|
| `createLowlight(common)` 每次渲染都重建 | 移到组件外部，只创建一次 |
| SSE finish 事件有 1500ms 人为延迟 | 移除，流式响应自然结束 |
| 连接等待使用 setInterval 轮询 | 改用 Promise + EventEmitter 事件 |

```
文件: src/components/OpenClawChat/AIMessageViewer.tsx, src/components/OpenClawChat/api.ts
```

## 修改的文件列表

| 文件 | 改动类型 |
|------|---------|
| `src/lib/openclaw/types.ts` | 新增 caps、auth.deviceToken、client.deviceFamily 字段 |
| `src/lib/openclaw/deviceIdentity.ts` | 新增 v3 签名载荷构建函数 |
| `src/lib/openclaw/gateway.ts` | 重写：EventEmitter、v3 签名、backend 模式、waitForConnection |
| `src/app/api/openclaw/chat/stream/route.ts` | 重写：事件监听模式、移除轮询 |
| `src/app/api/openclaw/chat/history/route.ts` | 简化：使用 waitForConnection |
| `src/app/api/openclaw/sessions/route.ts` | 修复：等待连接而非返回 503 |
| `src/app/api/openclaw/sessions/[key]/route.ts` | 修复：等待连接而非返回 503 |
| `src/components/OpenClawChat/AIMessageViewer.tsx` | lowlight 移到组件外部 |
| `src/components/OpenClawChat/api.ts` | 移除 1500ms 延迟 |

## 关键经验

1. **区分客户端角色**: Gateway 对不同客户端类型有不同策略。服务端代理必须用 `backend` 模式，不能用 `webchat`。
2. **不要用 expectFinal 对 chat.send**: `chat.send` 只返回 accepted，流式内容通过事件推送。
3. **重连必须重置状态**: `connectSent`、`connectNonce` 等握手状态在每次 `start()` 时必须清零。
4. **EventEmitter 替代单一回调**: 服务端单例 Gateway 需要支持多个并发请求独立监听事件。
5. **先看上游怎么做的**: 遇到协议问题时，参考 `src/gateway/client.ts`（Node.js 客户端）和 `ui/src/ui/gateway.ts`（浏览器客户端）的实现。
