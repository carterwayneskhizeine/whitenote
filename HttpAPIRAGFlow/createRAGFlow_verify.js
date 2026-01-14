const API_KEY = 'ragflow-61LVcg1JlwvJPHPmDLEHiw5NWfG6-QUvWShJ6gcbQSc';
const BASE_URL = 'http://localhost:4154';
const createRAGFlowKnowledgeBase = require('./createRAGFlow.js').createRAGFlowKnowledgeBase;

async function verifyChatConfig(chatId) {
  const response = await fetch(`${BASE_URL}/api/v1/chats?id=${chatId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  });

  const result = await response.json();
  console.log('验证聊天配置:', JSON.stringify(result, null, 2));
  
  if (result.code === 0 && result.data && result.data.length > 0) {
    const chatData = result.data[0];
    console.log('\n=== 关键配置信息 ===');
    console.log('Chat ID:', chatData.id);
    console.log('Chat Name:', chatData.name);
    console.log('Dataset IDs:', chatData.dataset_ids || '未找到 dataset_ids 字段');
    console.log('Datasets (detail):', chatData.datasets ? chatData.datasets.map(d => d.id) : '无');
    console.log('Prompt opener:', chatData.prompt.opener);
    console.log('Prompt empty_response:', chatData.prompt.empty_response);
    console.log('LLM model:', chatData.llm.model_name);
  }
}

// 测试自定义名称
async function testCustomNames() {
  console.log('\n=== 测试自定义名称 ===');
  
  // 使用时间戳避免名称冲突
  const timestamp = Date.now();
  
  try {
    const result = await createRAGFlowKnowledgeBase({
      datasetName: `WhiteNote_Knowledge_${timestamp}`,
      chatName: `Goldie_Rill_Assistant_${timestamp}`
    });
    
    console.log('\n创建成功！');
    console.log('Dataset ID:', result.datasetId);
    console.log('Chat ID:', result.chatId);
    
    // 验证配置
    await verifyChatConfig(result.chatId);
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n提示：如果出现名称重复错误，请先清理之前的测试数据，或使用新的名称');
  }
}

testCustomNames();
