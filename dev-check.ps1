<#
.SYNOPSIS
    带环境检查的开发模式启动脚本

.DESCRIPTION
    在启动开发服务器前检查环境配置是否正确

    【功能说明】
    - 自动检查当前环境配置
    - 检测是否在错误的环境（Docker 配置用于本地开发）
    - 提示切换到正确的环境
    - 通过检查后提示启动开发服务器

    【使用场景】
    - 日常开发时启动服务器
    - 确保环境配置正确后再启动
    - 避免因配置错误导致的连接问题

    【注意事项】
    1. 首次使用前请确保：
       → Docker Desktop 正在运行
       → PostgreSQL 和 Redis 容器已启动
       → .env 文件已正确配置

    2. 启动顺序建议：
       Terminal 1: pnpm dev (开发服务器)
       Terminal 2: pnpm worker (后台任务)
       Terminal 3: pnpm prisma studio (数据库管理，可选)

    3. 停止服务器：
       按 Ctrl+C

    【环境检查失败的常见原因】
    - 配置为 Docker 生产模式
      → 解决: 运行 .\switch-to-dev.ps1

    - Docker 容器未运行
      → 解决: docker ps 检查，docker-compose up -d 启动

    - 端口被占用
      → 解决: 检查其他服务是否占用 3005 端口

.EXAMPLE
    .\dev-check.ps1

.LINK
    .\switch-to-dev.ps1
    .\check-env.ps1
#>

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
Write-Host "  - Worker 服务需要在另一个终端启动: pnpm worker"
Write-Host ""

$response = Read-Host "是否现在启动？(Y/N)"
if ($response -eq "Y" -or $response -eq "y") {
    Write-Host ""
    Write-Info "正在启动开发服务器..."
    Write-Host ""
    Write-Warning "如果遇到数据库连接错误，请检查 Docker 容器是否运行"
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
