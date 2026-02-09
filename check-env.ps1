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

    Write-Warning "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}