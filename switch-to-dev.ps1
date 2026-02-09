<#
.SYNOPSIS
    快速切换到 Windows 本地开发模式

.DESCRIPTION
    从 Docker 生产模式切换到 Windows 本地开发模式

    【切换后需要做的事情】
    1. 停止所有 Docker 容器
       → docker-compose down

    2. 确保 Docker 数据库服务运行
       → docker ps (检查 pg16 和 redis 容器)
       → 如果未运行: docker-compose up -d postgres redis

    3. 重新构建项目
       → pnpm build

    4. 启动开发服务器
       → pnpm dev

    5. 启动 Worker (在新终端)
       → pnpm worker

    【验证环境】
    运行 .\check-env.ps1 检查配置是否正确

    【回滚】
    如需回滚，运行: cp .env.backup .env

.EXAMPLE
    .\switch-to-dev.ps1
#>

# 切换到 Windows 本地开发模式
.\switch-env.ps1 dev

Write-Host ""
Write-Warning "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
