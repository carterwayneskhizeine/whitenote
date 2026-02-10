<#
.SYNOPSIS
    检查当前环境配置是否正确

.DESCRIPTION
    验证当前 .env 配置是否与运行模式匹配

    【检查项目】
    1. NODE_ENV - 判断是生产模式还是开发模式
    2. DATABASE_URL - 检查数据库连接地址
    3. REDIS_URL - 检查 Redis 连接地址

    【环境判断逻辑】
    - 如果 NODE_ENV=production → Docker 生产模式
    - 如果 NODE_ENV 被注释 → 本地开发模式

    【使用时机】
    ✓ 启动开发服务器前 (pnpm dev)
    ✓ 启动 Worker 前 (pnpm worker)
    ✓ 切换环境后验证配置
    ✓ 遇到连接问题时诊断

    【检测结果】
    - 配置正确 (本地开发模式)
      → 显示绿色 ✓，退出码 0

    - 配置错误 (Docker 生产模式)
      → 显示红色 ✗，提示切换环境
      → 询问是否自动切换到开发模式

    【常见错误】
    1. "当前是 Docker 生产模式配置！"
       → 原因: .env 中 NODE_ENV=production
       → 解决: 运行 .\switch-to-dev.ps1

    2. "数据库连接失败"
       → 原因: Docker 容器未运行
       → 解决: docker ps 检查容器状态

    3. "Redis 连接失败"
       → 原因: Redis 容器未运行或端口错误
       → 解决: docker-compose up -d redis

    【示例输出】
    正确的开发模式配置：
    ✓ 当前配置正确（本地开发模式）
      可以安全启动开发服务器：
        pnpm dev

    错误的生产模式配置：
    ✗ 当前是 Docker 生产模式配置！
      本地开发请先运行: .\switch-to-dev.ps1

.EXAMPLE
    .\check-env.ps1

.LINK
    .\switch-to-dev.ps1
    .\switch-to-docker.ps1
    .\switch-env.ps1
#>

# 检查当前环境配置是否正确
$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green "✓ $args" }
function Write-Error { Write-ColorOutput Red "✗ $args" }
function Write-Info { Write-ColorOutput Cyan "ℹ $args" }
function Write-Warning { Write-ColorOutput Yellow "⚠ $args" }

$EnvFile = ".env"
$Content = Get-Content $EnvFile -Raw

Write-Host ""
Write-Info "正在检查环境配置..."
Write-Host ""

# 显示当前配置
if ($Content -match 'NODE_ENV=production') {
    Write-Host "当前模式: " -NoNewline
    Write-Host "Docker 生产模式" -ForegroundColor Yellow
} else {
    Write-Host "当前模式: " -NoNewline
    Write-Host "本地开发模式" -ForegroundColor Green
}

if ($Content -match 'DATABASE_URL="postgresql://myuser:mypassword@([^"]+)"') {
    Write-Host "数据库地址: " -NoNewline
    Write-Host $matches[1] -ForegroundColor Cyan
}

if ($Content -match 'REDIS_URL="([^"]+)"') {
    Write-Host "Redis 地址: " -NoNewline
    Write-Host $matches[1] -ForegroundColor Cyan
}

Write-Host ""

# 检查 NODE_ENV
if ($Content -match '^NODE_ENV=production') {
    Write-Warning "⚠ 当前是 Docker 生产模式配置！"
    Write-Warning "本地开发请先运行: " -NoNewline
    Write-Host ".\switch-to-dev.ps1" -ForegroundColor White
    Write-Host ""

    $response = Read-Host "是否现在切换到开发模式？(Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host ""
        Write-Info "正在切换到开发模式..."
        Write-Host ""
        .\switch-to-dev.ps1
    } else {
        Write-Host ""
        Write-Warning "已取消切换，请手动切换后重试"
    }

    Write-Host ""
    Write-Warning "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
} else {
    Write-Success "当前配置正确（本地开发模式）"
    Write-Host ""

    Write-Info "可以安全启动开发服务器："
    Write-Host "  pnpm dev"
    Write-Host ""
    Write-Info "启动 Worker（新终端）："
    Write-Host "  pnpm worker"
    Write-Host ""

    Write-Warning "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}
