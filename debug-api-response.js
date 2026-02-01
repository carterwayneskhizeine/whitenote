// 测试子评论 API 的实际返回顺序
const COMMENT_ID = 'cml3zzlg40000zgimb9dcgv0h';

async function testChildCommentsAPI() {
  console.log('测试子评论 API 返回顺序\n');
  console.log('=====================================\n');

  const response = await fetch(`http://localhost:3005/api/public/comments/${COMMENT_ID}/children`);

  if (!response.ok) {
    console.error('API 请求失败:', response.status, response.statusText);
    return;
  }

  const data = await response.json();
  const comments = data.data;

  console.log(`API 返回 ${comments.length} 条子评论\n`);

  console.log('返回的评论顺序（按 API 返回顺序）:');
  comments.forEach((c, i) => {
    const created = new Date(c.createdAt).toLocaleString('zh-CN', { hour12: false });
    console.log(`  ${i + 1}. ${created} - ${c.id.substring(0, 10)}...`);
  });

  // 验证排序
  const dates = comments.map(c => new Date(c.createdAt).getTime());
  const isSortedAsc = dates.every((date, i) => i === 0 || date >= dates[i - 1]);
  const isSortedDesc = dates.every((date, i) => i === 0 || date <= dates[i - 1]);

  console.log('\n排序验证:');
  console.log(`  升序（最早→最新）: ${isSortedAsc ? '✅ 是' : '❌ 否'}`);
  console.log(`  降序（最新→最早）: ${isSortedDesc ? '✅ 是' : '❌ 否'}`);

  console.log('\n预期: 升序（HARDCODED_SORT_ORDER = false）');

  if (!isSortedAsc && !isSortedDesc) {
    console.log('⚠️ 警告: 评论顺序无规律，可能有问题！');
  }
}

testChildCommentsAPI().catch(console.error);
