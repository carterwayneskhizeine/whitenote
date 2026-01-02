# Messages API 测试指南

## 方法 1: 使用浏览器测试页面（推荐）⭐

1. 确保开发服务器正在运行：
   ```bash
   pnpm dev
   ```

2. 在浏览器中打开测试页面：
   ```
   http://localhost:3005/test-api.html
   ```

3. 如果未登录，点击"去登录"按钮，使用测试账号登录：
   - Email: `owner@whitenote.local`
   - Password: `admin123`

4. 登录后回到测试页面，即可测试所有 API 端点：
   - ✅ 创建消息
   - ✅ 获取消息列表（支持分页、过滤）
   - ✅ 获取单条消息详情
   - ✅ 更新消息（自动保存版本历史）
   - ✅ 切换收藏/置顶状态
   - ✅ 删除消息

---

## 方法 2: 使用 cURL 测试

### 步骤 1: 获取 Session Token

1. 在浏览器中访问 http://localhost:3005/login
2. 登录后，按 F12 打开开发者工具
3. 进入 Application → Storage → Cookies
4. 找到 `next-auth.session-token` 并复制其值

### 步骤 2: 设置环境变量

```bash
# 设置你的 session token
export SESSION_TOKEN="你的session_token值"
```

### 步骤 3: 测试 API 端点

#### 1. 创建消息
```bash
curl -X POST http://localhost:3005/api/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
  -d '{
    "content": "Hello WhiteNote! This is a test message.",
    "title": "Test Message",
    "tags": ["test", "api", "first"]
  }'
```

**预期响应**：
```json
{
  "data": {
    "id": "cmjxxxxx",
    "title": "Test Message",
    "content": "Hello WhiteNote! This is a test message.",
    "createdAt": "2026-01-02T...",
    "isStarred": false,
    "isPinned": false,
    "author": { "id": "...", "name": "Owner" },
    "tags": [
      { "tag": { "id": "...", "name": "test" } }
    ],
    "_count": { "children": 0, "comments": 0 }
  }
}
```

#### 2. 获取消息列表
```bash
# 获取所有消息（默认分页）
curl http://localhost:3005/api/messages \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"

# 获取仅根消息（不包含 Thread 回复）
curl "http://localhost:3005/api/messages?rootOnly=true" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"

# 获取收藏的消息
curl "http://localhost:3005/api/messages?isStarred=true" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"

# 分页查询
curl "http://localhost:3005/api/messages?page=1&limit=10" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"
```

#### 3. 获取单条消息详情
```bash
# 替换 MESSAGE_ID 为实际的消息 ID
curl http://localhost:3005/api/messages/MESSAGE_ID \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"
```

**预期响应**：包含消息详情、子消息、评论、反向链接、版本计数等

#### 4. 更新消息
```bash
curl -X PUT http://localhost:3005/api/messages/MESSAGE_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
  -d '{
    "content": "Updated content with new information",
    "title": "Updated Title"
  }'
```

> 💡 更新时会自动保存旧版本到 `MessageVersion` 表

#### 5. 切换收藏状态
```bash
curl -X POST http://localhost:3005/api/messages/MESSAGE_ID/star \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"
```

#### 6. 切换置顶状态
```bash
curl -X POST http://localhost:3005/api/messages/MESSAGE_ID/pin \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"
```

#### 7. 删除消息
```bash
curl -X DELETE http://localhost:3005/api/messages/MESSAGE_ID \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"
```

---

## 方法 3: 验证数据库状态

### 检查消息是否创建成功
```bash
docker exec pg16 psql -U myuser -d whitenote -c "
  SELECT
    id,
    title,
    LEFT(content, 50) as content_preview,
    \"isStarred\",
    \"isPinned\",
    \"createdAt\"
  FROM \"Message\"
  ORDER BY \"createdAt\" DESC
  LIMIT 5;
"
```

### 检查标签关联
```bash
docker exec pg16 psql -U myuser -d whitenote -c "
  SELECT
    m.id,
    m.content,
    t.name as tag_name
  FROM \"Message\" m
  JOIN \"MessageTag\" mt ON m.id = mt.\"messageId\"
  JOIN \"Tag\" t ON mt.\"tagId\" = t.id
  ORDER BY m.\"createdAt\" DESC
  LIMIT 10;
"
```

### 检查版本历史
```bash
docker exec pg16 psql -U myuser -d whitenote -c "
  SELECT
    mv.\"messageId\",
    LEFT(mv.content, 50) as version_content,
    mv.\"createdAt\"
  FROM \"MessageVersion\" mv
  ORDER BY mv.\"createdAt\" DESC
  LIMIT 5;
"
```

---

## 测试检查点

### ✅ 基本功能测试

- [ ] 创建消息（带标签）
- [ ] 获取消息列表（验证分页）
- [ ] 获取单条消息（验证权限检查）
- [ ] 更新消息内容（验证版本历史保存）
- [ ] 切换收藏状态
- [ ] 切换置顶状态
- [ ] 删除消息

### ✅ 数据隔离测试

```bash
# 用户 A 创建的消息，用户 B 不应该能看到
# 1. 用户 A 登录并创建消息
# 2. 用户 B 登录并查询消息列表
# 3. 验证用户 B 看不到用户 A 的消息
```

### ✅ 权限测试

```bash
# 尝试访问其他用户的消息（应该返回 403）
curl http://localhost:3005/api/messages/OTHER_USER_MESSAGE_ID \
  -H "Cookie: next-auth.session-token=$YOUR_SESSION_TOKEN"
# 预期响应: {"error":"Forbidden"}
```

### ✅ 未认证测试

```bash
# 不带 Cookie 访问（应该返回 401）
curl http://localhost:3005/api/messages
# 预期响应: {"error":"Unauthorized"}
```

---

## 故障排查

### 问题 1: 401 Unauthorized

**原因**：未登录或 session token 过期

**解决方案**：
1. 重新登录获取新的 session token
2. 检查 Cookie 格式是否正确

### 问题 2: 403 Forbidden

**原因**：尝试访问其他用户的消息

**解决方案**：
- 确认消息 ID 是当前用户创建的
- 检查数据库中的 `authorId` 字段

### 问题 3: 404 Not Found

**原因**：消息 ID 不存在

**解决方案**：
- 确认消息 ID 格式正确（cuid 格式，如 `cmjwop12e0000rwimpsopzi98`）
- 使用 `GET /api/messages` 先获取有效的消息 ID

---

## 性能测试

### 批量创建消息
```bash
for i in {1..100}; do
  curl -X POST http://localhost:3005/api/messages \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=$SESSION_TOKEN" \
    -d "{\"content\":\"Test message $i\",\"tags\":[\"batch\",\"test\"]}"
  echo "Created message $i"
done
```

### 测试分页性能
```bash
time curl "http://localhost:3005/api/messages?page=1&limit=50" \
  -H "Cookie: next-auth.session-token=$SESSION_TOKEN"
```

---

## 下一步

测试通过后，继续实现：
- [Stage 5: Tags/Comments/Templates API](./BACKEND_STAGE_05_OTHER_API.md)
