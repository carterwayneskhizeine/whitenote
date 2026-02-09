# 带环境检查的开发模式启动脚本
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

# 先检查环境配置
.\check-env.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Error "环境配置不正确，已取消启动"
    Write-Host ""

    Write-Warning "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 环境检查通过，询问是否启动
Write-Host ""
Write-Success "环境配置检查通过！"
Write-Host ""
Write-Info "准备启动开发服务器..."
Write-Host ""
Write-Host "提示："
Write-Host "  - 开发服务器将运行在 http://localhost:3005"
Write-Host "  - 按 Ctrl+C 可停止服务器"
Write-Host ""

$response = Read-Host "是否现在启动？(Y/N)"
if ($response -eq "Y" -or $response -eq "y") {
    Write-Host ""
    Write-Info "正在启动开发服务器..."
    Write-Host ""
    pnpm dev
} else {
    Write-Host ""
    Write-Warning "已取消启动"
    Write-Host ""

    Write-Warning "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}
