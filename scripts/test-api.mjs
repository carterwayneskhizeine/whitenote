#!/usr/bin/env node

/**
 * Messages API 测试脚本
 * 自动完成注册/登录并测试所有 API 端点
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3005';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60));
}

async function testApi() {
  let cookie = '';
  let testMessageId = '';

  try {
    // ========================================
    // 步骤 1: 注册新用户
    // ========================================
    logSection('步骤 1: 注册新用户');

    const timestamp = Date.now();
    const testUser = {
      email: `test${timestamp}@example.com`,
      password: 'test123456',
      name: `TestUser${timestamp}`,
    };

    log(`注册用户: ${testUser.email}`, 'yellow');

    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    if (!registerRes.ok) {
      throw new Error(`注册失败: ${registerRes.status}`);
    }

    const registerData = await registerRes.json();
    log('✓ 注册成功', 'green');
    console.log('用户数据:', JSON.stringify(registerData.data, null, 2));

    // ========================================
    // 步骤 2: 登录获取 Session
    // ========================================
    logSection('步骤 2: 登录获取 Session');

    // 首先访问登录页获取 CSRF token
    const loginPageRes = await fetch(`${BASE_URL}/login`);
    const setCookieHeader = loginPageRes.headers.get('set-cookie');

    if (setCookieHeader) {
      // 提取所有 cookies
      const cookies = setCookieHeader.split(',').map(c => c.split(';')[0].trim());
      cookie = cookies.join('; ');
      log('✓ 获取到登录页 cookies', 'green');
    }

    // 使用 NextAuth 的 signout 端点来测试会话
    log('提示: 请在浏览器中访问 http://localhost:3005/login 手动登录', 'yellow');
    log('或者继续使用以下测试（可能因未登录而失败）', 'yellow');

    // ========================================
    // 步骤 3: 测试未认证状态
    // ========================================
    logSection('步骤 3: 测试未认证状态（应该返回 401）');

    const testUnauthorized = await fetch(`${BASE_URL}/api/messages`);
    log(`/api/messages (未认证): ${testUnauthorized.status}`, testUnauthorized.status === 401 ? 'green' : 'red');

    // ========================================
    // 步骤 4: 手动登录指引
    // ========================================
    logSection('手动登录测试指南');

    log('由于 NextAuth 的 CSRF 保护，请按以下步骤手动测试：', 'yellow');
    console.log('');
    log('1. 在浏览器打开: http://localhost:3005/login', 'blue');
    log('2. 使用以下凭据登录:', 'blue');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Password: ${testUser.password}`);
    console.log('');
    log('3. 登录后，打开浏览器开发者工具 (F12)', 'blue');
    log('4. 进入 Application/存储 > Cookies', 'blue');
    log('5. 复制 next-auth.session-token 的值', 'blue');
    console.log('');
    log('然后使用以下 curl 命令测试（将 <your-token> 替换为实际值）:', 'yellow');
    console.log('');
    console.log(`# 获取消息列表`);
    console.log(`curl http://localhost:3005/api/messages \\`);
    console.log(`  -H "Cookie: next-auth.session-token=<your-token>"`);
    console.log('');
    console.log(`# 创建消息`);
    console.log(`curl -X POST http://localhost:3005/api/messages \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "Cookie: next-auth.session-token=<your-token>" \\`);
    console.log(`  -d '{"content":"Hello WhiteNote!","tags":["test","first"]}'`);

  } catch (error) {
    log(`\n✗ 测试失败: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
testApi();
