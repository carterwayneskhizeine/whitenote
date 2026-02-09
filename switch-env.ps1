<#
.SYNOPSIS
    WhiteNote 环境切换脚本

.DESCRIPTION
    在 Windows 本地开发模式和 Docker 生产模式之间切换环境配置

    【环境说明】
    ┌────────────────────────────────────────────────────────────────┐
    │ Windows 本地开发模式 (dev)                                   │
    ├────────────────────────────────────────────────────────────────┤
    │ - Next.js 直接在 Windows 上运行                              │
    │ - 数据库和 Redis 通过 Docker 端口映射访问                    │
    │ - PostgreSQL: localhost:5925                                │
    │ - Redis: localhost:16379                                     │
    │ - 文件监控路径: ./data/link_md                               │
    │ - 适用场景: 日常开发、调试                                    │
    └────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────────┐
    │ Docker 生产模式 (docker)                                      │
    ├────────────────────────────────────────────────────────────────┤
    │ - 所有服务在 Docker 容器中运行                               │
    │ - 数据库: postgres:5432 (容器网络)                           │
    │ - Redis: redis:6379 (容器网络)                               │
    │ - 文件监控路径: /app/data/link_md                            │
    │ - 适用场景: 生产部署、Linux 环境运行                          │
    └────────────────────────────────────────────────────────────────┘

    【切换前注意事项】
    1. 停止所有运行的服务 (pnpm dev, pnpm worker, docker-compose)
    2. 确保备份重要数据
    3. 切换后需要重新构建: pnpm build

    【常见问题】
    - 从 Docker 切换到本地开发后，数据库连接失败？
      → 检查 Docker 容器是否运行: docker ps
      → 确保端口映射正确: 5432→5925, 6379→16379

    - 从本地开发切换到 Docker 后构建失败？
      → 清理缓存: rm -rf .next
      → 重新构建: pnpm build

    - Worker 进程找不到数据库？
      → Worker 也需要切换环境，检查其 DATABASE_URL

.PARAMETER Mode
    目标环境模式: "dev" 或 "docker"

.EXAMPLE
    # 切换到本地开发模式
    .\switch-env.ps1 dev

    # 切换到 Docker 生产模式
    .\switch-env.ps1 docker
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "docker", "")]
    [string]$Mode
)

$ErrorActionPreference = "Stop"
$EnvFile = ".env"
$BackupFile = ".env.backup"

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

# 检查 .env 文件是否存在
if (!(Test-Path $EnvFile)) {
    Write-Error ".env 文件不存在！"
    exit 1
}

# 备份当前 .env 文件
Write-Info "备份当前配置到 $BackupFile ..."
Copy-Item $EnvFile $BackupFile -Force

# 读取 .env 内容
$content = Get-Content $EnvFile -Raw

# Windows 本地开发模式配置
# 注意:
# - 数据库和 Redis 使用 Docker 端口映射
# - 确保 Docker 容器在运行: docker ps
# - 节点使用 localhost 而非容器名称
$DevConfig = @{
    NODE_ENV = '# NODE_ENV=production  # 本地开发注释掉，Docker 部署时取消注释'
    DATABASE_URL = 'DATABASE_URL="postgresql://myuser:mypassword@localhost:5925/whitenote?schema=public"'
    REDIS_URL = 'REDIS_URL="redis://localhost:16379"'
    FILE_WATCHER_DIR = 'FILE_WATCHER_DIR=./data/link_md'
}

# Docker 生产模式配置
# 注意:
# - 容器间使用服务名称 (postgres, redis)
# - 路径使用容器内部路径 (/app/data)
# - 需要预先构建: pnpm build
$DockerConfig = @{
    NODE_ENV = 'NODE_ENV=production'
    DATABASE_URL = 'DATABASE_URL="postgresql://myuser:mypassword@postgres:5432/whitenote?schema=public"'
    REDIS_URL = 'REDIS_URL="redis://redis:6379"'
    FILE_WATCHER_DIR = 'FILE_WATCHER_DIR=/app/data/link_md'
}

switch ($Mode) {
    "dev" {
        Write-Info "切换到 Windows 本地开发模式..."
        Write-Warning "请确保 Docker 中的服务正在运行："
        Write-Warning "  - PostgreSQL: localhost:5925"
        Write-Warning "  - Redis: localhost:16379"
        Write-Host ""
        Write-Warning "检查命令: docker ps"
        Write-Host ""

        $config = $DevConfig
        $ModeName = "本地开发"
    }

    "docker" {
        Write-Info "切换到 Docker 生产模式..."
        Write-Warning "切换后需要执行以下步骤："
        Write-Warning "  1. 构建项目: pnpm build"
        Write-Warning "  2. 构建镜像: pnpm docker:dev:build"
        Write-Warning "  3. 启动容器: pnpm docker:dev"
        Write-Host ""
        Write-Warning "或者使用生产模式: pnpm docker:prod"
        Write-Host ""

        $config = $DockerConfig
        $ModeName = "Docker 生产"
    }
}

# 应用配置
foreach ($key in $config.Keys) {
    $value = $config[$key]

    switch ($key) {
        "NODE_ENV" {
            # NODE_ENV 特殊处理（注释/取消注释）
            if ($Mode -eq "dev") {
                $content = $content -replace '^NODE_ENV=production', '# NODE_ENV=production  # 本地开发注释掉，Docker 部署时取消注释'
            } else {
                $content = $content -replace '# NODE_ENV=production.*', 'NODE_ENV=production'
            }
        }

        "DATABASE_URL" {
            $content = $content -replace 'DATABASE_URL="postgresql://myuser:mypassword@[^"]+"', $value
        }

        "REDIS_URL" {
            $content = $content -replace 'REDIS_URL="[^"]+"', $value
        }

        "FILE_WATCHER_DIR" {
            $content = $content -replace 'FILE_WATCHER_DIR=[^\r\n]*', $value
        }
    }
}

# 写入修改后的内容
$content | Out-File -FilePath $EnvFile -Encoding UTF8 -NoNewline

Write-Success "已切换到 $ModeName 模式！"
Write-Host ""
Write-Info "当前配置："
Write-Host "  NODE_ENV:         " -NoNewline
if ($Mode -eq "dev") {
    Write-Host "undefined (开发模式)" -ForegroundColor Green
} else {
    Write-Host "production" -ForegroundColor Yellow
}
Write-Host "  DATABASE_URL:     " -NoNewline
if ($Mode -eq "dev") {
    Write-Host "localhost:5925" -ForegroundColor Green
} else {
    Write-Host "postgres:5432" -ForegroundColor Yellow
}
Write-Host "  REDIS_URL:        " -NoNewline
if ($Mode -eq "dev") {
    Write-Host "localhost:16379" -ForegroundColor Green
} else {
    Write-Host "redis:6379" -ForegroundColor Yellow
}
Write-Host "  FILE_WATCHER_DIR: " -NoNewline
if ($Mode -eq "dev") {
    Write-Host "./data/link_md" -ForegroundColor Green
} else {
    Write-Host "/app/data/link_md" -ForegroundColor Yellow
}
Write-Host ""

# 显示下一步操作
if ($Mode -eq "dev") {
    Write-Info "下一步操作："
    Write-Host "  1. 确保 Docker 运行: docker ps"
    Write-Host "  2. 构建项目: pnpm build"
    Write-Host "  3. 启动服务: pnpm dev"
    Write-Host "  4. 启动 Worker: pnpm worker"
    Write-Host "  5. 访问: http://localhost:3005"
    Write-Host ""
    Write-Warning "提示: 如果遇到数据库连接错误，请检查 Docker 容器是否运行"
} else {
    Write-Info "下一步操作："
    Write-Host "  1. 停止本地服务: Ctrl+C"
    Write-Host "  2. 构建项目: pnpm build"
    Write-Host "  3. 构建 Docker 镜像: pnpm docker:dev:build"
    Write-Host "  4. 启动容器: pnpm docker:dev"
    Write-Host "  5. 访问: http://localhost:3005"
    Write-Host ""
    Write-Warning "注意: Docker 模式下所有服务在容器中运行"
}
Write-Host ""
Write-Info "如需恢复原配置，备份文件位于: $BackupFile"
Write-Host ""
Write-Warning "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
