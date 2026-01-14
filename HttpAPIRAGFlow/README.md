# RAGFlow API 自动化脚本

本脚本用于通过 RAGFlow HTTP API 自动创建知识库、向量化文本并绑定聊天助手。

## 功能特性

- ✅ 创建指定名称的知识库
- ✅ 自定义聊天助手名称
- ✅ 上传文件并添加文本 chunk
- ✅ 自动向量化文本内容
- ✅ 创建聊天助手并绑定知识库
- ✅ 自定义系统提示词
- ✅ 关闭默认开场白和空回复

## 安装依赖

```bash
pnpm install
```

## 使用方法

### 基础用法（使用默认名称）

```bash
node createRAGFlow.js
node createRAGFlow_verify.js
```

### 自定义名称

修改 `createRAGFlow_verify.js` 中的调用参数：

```javascript
async function testCustomNames() {
  const result = await createRAGFlowKnowledgeBase({
    datasetName: 'My_Custom_Dataset',
    chatName: 'My_Custom_Chat'
  });
  
  console.log('Dataset ID:', result.datasetId);
  console.log('Chat ID:', result.chatId);
}

testCustomNames();
```

## 自定义参数

### 可自定义的参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|---------|--------|
| `datasetName` | 知识库名称 | `'my_knowledge_base'` | `'WhiteNote_Data'` |
| `chatName` | 聊天助手名称 | `'my_chat_assistant'` | `'Goldie_Rill'` |
| `embeddingModel` | 嵌入模型 | `'Qwen/Qwen3-Embedding-8B@SILICONFLOW'` | 需在 RAGFlow 中配置 |
| `chunkMethod` | 分块方法 | `'one'` | `'naive'`, `'qa'` 等 |
| `content` | 初始向量化文本 | 默认预设文本 | 自定义文本内容 |

### 固定参数（当前版本）

| 参数 | 说明 | 值 |
|------|------|-----|
| `API_KEY` | RAGFlow API 密钥 | 从环境变量或代码中设置 |
| `BASE_URL` | RAGFlow 服务地址 | `'http://localhost:4154'` |

### 系统提示词配置

```javascript
// 在 createRAGFlow.js 中修改
body: JSON.stringify({
  dataset_ids: [datasetId],
  prompt: {
    prompt: "你是一个运行在 WhiteNote 的智能助手你叫 Goldie Rill..."
  }
})
```

### 聊天配置更新

| 配置项 | 说明 | API 设置 |
|---------|------|----------|
| 开场白 | 系统欢迎语 | `opener: null` 关闭 |
| 空回复 | 无结果时回复 | `empty_response: null` 关闭 |
| 自定义提示词 | 完整的系统指令 | `prompt` 字段 |
| 知识库绑定 | 关联的数据集 | `dataset_ids` 数组 |

### LLM 模型参数

**注意：** 当前版本通过 API 创建/更新聊天时，LLM 参数（temperature、top_p、presence_penalty、frequency_penalty、max_tokens）会使用系统默认值，无法通过 API 直接修改。

如需调整这些参数，请在 RAGFlow Web UI 中手动配置。

## API 端点说明

### 1. 创建知识库

```
POST /api/v1/datasets
```

**请求参数：**
- `name` (必填): 知识库名称
- `embedding_model` (可选): 嵌入模型名称
- `chunk_method` (可选): 分块方法
- `permission` (可选): 权限 (`"me"` 或 `"team"`)
- `description` (可选): 描述
- `avatar` (可选): 头像（Base64）

### 2. 上传文档

```
POST /api/v1/datasets/{dataset_id}/documents
```

**请求参数：**
- `file` (必填): 文档文件（multipart/form-data）

### 3. 添加 Chunk

```
POST /api/v1/datasets/{dataset_id}/documents/{document_id}/chunks
```

**请求参数：**
- `content` (必填): 文本内容
- `important_keywords` (可选): 关键词列表
- `questions` (可选): 相关问题列表

### 4. 创建聊天助手

```
POST /api/v1/chats
```

**请求参数：**
- `name` (必填): 聊天助手名称
- `dataset_ids` (可选): 关联的知识库 ID 数组
- `llm` (可选): LLM 模型配置
  - `model_name`: 模型名称
  - `temperature`: 温度（0-2）
  - `top_p`: 采样参数（0-1）
  - `presence_penalty`: 存在惩罚（0-2）
  - `frequency_penalty`: 频率惩罚（0-2）
  - `max_tokens`: 最大 tokens
- `prompt` (可选): 系统提示词配置
  - `prompt`: 系统指令
  - `opener`: 开场白
  - `empty_response`: 空回复
  - `similarity_threshold`: 相似度阈值（0-1）
  - `top_n`: 返回 chunk 数量
  - `variables`: 变量列表

### 5. 更新聊天助手

```
PUT /api/v1/chats/{chat_id}
```

**请求参数：** 同创建聊天助手

### 6. 使用对话 API

```
POST /api/v1/chats/{chat_id}/completions
```

**请求参数：**
- `question` (必填): 用户问题
- `stream` (可选): 是否流式输出（true/false）
- `session_id` (可选): 会话 ID

### 7. OpenAI 兼容接口

```
POST /api/v1/chats_openai/{chat_id}/chat/completions
```

**请求参数：** 与 OpenAI Chat Completions API 兼容

```javascript
{
  "model": "any",
  "messages": [
    {"role": "user", "content": "你的问题"}
  ],
  "stream": false,
  "extra_body": {
    "reference": true
  }
}
```

## 响应示例

### 创建成功响应

```json
{
  "code": 0,
  "data": {
    "id": "40ae5302f15211f0933792ca3d21012d",
    "name": "my_knowledge_base",
    "embedding_model": "Qwen/Qwen3-Embedding-8B@SILICONFLOW",
    "chunk_method": "one",
    "parser_config": {...}
  }
}
```

### 错误响应

```json
{
  "code": 101,
  "message": "Dataset name 'my_knowledge_base' already exists"
}
```

## 常见问题

### Q1: 如何修改知识库的 PDF 解析器？

**A:** PDF 解析器无法通过 API 直接设置。需要在 RAGFlow Web UI 中手动配置，或创建自定义 Ingestion Pipeline。

### Q2: 如何关闭 LLM 模型参数？

**A:** 在更新聊天配置时，将这些参数设置为 `null`：

```javascript
body: JSON.stringify({
  llm: {
    model_name: "your_model",
    temperature: null,
    top_p: null,
    presence_penalty: null,
    frequency_penalty: null,
    max_tokens: null
  }
})
```

**注意：** 当前版本通过 API 设置 `null` 可能不生效，建议在 UI 中手动调整。

### Q3: 聊天没有绑定知识库怎么办？

**A:** 检查创建聊天时是否正确传递 `dataset_ids` 参数，并在更新时重新绑定：

```javascript
PUT /api/v1/chats/{chat_id}
{
  "dataset_ids": ["your_dataset_id"]
}
```

### Q4: 如何查看聊天是否绑定知识库？

**A:** 调用获取聊天接口，检查 `datasets` 或 `dataset_ids` 字段：

```javascript
GET /api/v1/chats?id={chat_id}
```

返回数据中会包含：
- `dataset_ids`: 知识库 ID 数组
- `datasets`: 知识库详细信息数组

### Q5: 分块方法有哪些可选值？

**A:** 
- `"naive"`: 通用（默认）
- `"book"`: 书籍
- `"email"`: 邮件
- `"laws"`: 法律文档
- `"manual"`: 手动
- `"one"`: One
- `"paper"`: 论文
- `"picture"`: 图片
- `"presentation"`: 演示文稿
- `"qa"`: 问答
- `"table"`: 表格
- `"tag"`: 标签

## 开发建议

1. **错误处理**: 所有 API 调用都应检查 `code` 字段，`0` 表示成功
2. **日志输出**: 使用 `console.log` 输出详细响应，便于调试
3. **参数验证**: 创建前验证必填参数是否为空
4. **资源清理**: 测试后及时删除临时文件
5. **环境配置**: 建议将 `API_KEY` 和 `BASE_URL` 放入环境变量

## License

MIT
