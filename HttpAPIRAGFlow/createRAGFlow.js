const API_KEY = 'ragflow-61LVcg1JlwvJPHPmDLEHiw5NWfG6-QUvWShJ6gcbQSc';
const BASE_URL = 'http://localhost:4154';
const fs = require('fs');
const path = require('path');

async function createRAGFlowKnowledgeBase({
  datasetName = 'my_knowledge_base',
  chatName = 'my_chat_assistant'
} = {}) {
  const embeddingModel = 'Qwen/Qwen3-Embedding-8B@SILICONFLOW';
  const content = '这是一条预设的向量化文本内容，用于初始化知识库。';

  // 1. 创建知识库
  const createDatasetResponse = await fetch(`${BASE_URL}/api/v1/datasets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      name: datasetName,
      embedding_model: embeddingModel,
      chunk_method: 'one'
    })
  });
  
  const datasetResult = await createDatasetResponse.json();
  console.log('创建知识库响应:', JSON.stringify(datasetResult, null, 2));
  
  if (datasetResult.code !== 0 || !datasetResult.data) {
    throw new Error(`创建知识库失败: ${datasetResult.message}`);
  }
  
  const datasetId = datasetResult.data.id;
  console.log('Dataset ID:', datasetId);

  // 2. 创建文档（用于添加 chunk）- 需要上传文件
  const tempFilePath = path.join(__dirname, 'temp_init.txt');
  fs.writeFileSync(tempFilePath, content);
  
  const fileContent = fs.readFileSync(tempFilePath);
  const boundary = '----FormBoundary' + Date.now().toString(16);
  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="temp_init.txt"\r\n`,
    `Content-Type: text/plain\r\n\r\n`,
    fileContent.toString('utf-8'),
    `\r\n`,
    `--${boundary}--\r\n`
  ];
  const body = Buffer.from(bodyParts.join(''));
  
  const createDocumentResponse = await fetch(`${BASE_URL}/api/v1/datasets/${datasetId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
  });
  
  const documentResult = await createDocumentResponse.json();
  console.log('创建文档响应:', JSON.stringify(documentResult, null, 2));
  
  if (documentResult.code !== 0 || !documentResult.data || documentResult.data.length === 0) {
    throw new Error(`创建文档失败: ${documentResult.message}`);
  }
  
  const documentId = documentResult.data[0].id;
  console.log('Document ID:', documentId);

  // 3. 添加 chunk（向量化）- 直接添加到知识库
  const addChunkResponse = await fetch(`${BASE_URL}/api/v1/datasets/${datasetId}/documents/${documentId}/chunks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      content: content
    })
  });
  
  const chunkResult = await addChunkResponse.json();
  console.log('添加 Chunk 响应:', JSON.stringify(chunkResult, null, 2));
  console.log('Chunk added:', chunkResult.data?.chunk);

  // 4. 创建聊天（绑定知识库）- 不设置默认值
  const createChatResponse = await fetch(`${BASE_URL}/api/v1/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      name: 'Goldie_Rill_chat',
      dataset_ids: [datasetId],
      prompt: {
        prompt: "你是一个运行在 WhiteNote 的智能助手你叫 Goldie Rill，请总结 WhiteNote 帖子的内容来回答问题，请列举 WhiteNote 帖子中的数据详细回答。当所有WhiteNote 帖子内容都与问题无关时，你的回答必须包括\"WhiteNote 中未找到您要的答案！\"这句话。回答需要考虑聊天历史。以下是 WhiteNote 帖子：{knowledge}以上是 WhiteNote 帖子。"
      }
    })
  });
  
  const chatResult = await createChatResponse.json();
  console.log('创建聊天响应:', JSON.stringify(chatResult, null, 2));
  
  if (chatResult.code !== 0 || !chatResult.data) {
    throw new Error(`创建聊天失败: ${chatResult.message}`);
  }
  
  const chatId = chatResult.data.id;
  console.log('Chat ID:', chatId);

  // 5. 更新聊天配置 - 关闭LLM模型参数和空回复/开场白，并确保绑定知识库
  const updateChatResponse = await fetch(`${BASE_URL}/api/v1/chats/${chatId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      dataset_ids: chatResult.data.dataset_ids,
      prompt: {
        prompt: chatResult.data.prompt.prompt,
        empty_response: null,
        opener: null
      }
    })
  });
  
  const updateResult = await updateChatResponse.json();
  console.log('更新聊天配置响应:', JSON.stringify(updateResult, null, 2));
  
  if (updateResult.code !== 0) {
    console.warn('更新聊天配置警告:', updateResult.message);
  }

  // 返回结果
  return {
    datasetId: datasetId,
    chatId: chatId
  };
}

module.exports = { createRAGFlowKnowledgeBase };

// 使用示例
if (require.main === module) {
  createRAGFlowKnowledgeBase()
    .then(result => {
      console.log('创建成功！');
      console.log('Dataset ID:', result.datasetId);
      console.log('Chat ID:', result.chatId);
    })
    .catch(error => {
      console.error('创建失败:', error);
    });
}