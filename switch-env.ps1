# WhiteNote 环境切换脚本
# 用法: .\switch-env.ps1 [mode]
# mode: "dev" (Windows 本地开发) 或 "docker" (Docker 生产)

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
$DevConfig = @{
    NODE_ENV = '# NODE_ENV=production  # 本地开发注释掉，Docker 部署时取消注释'
    DATABASE_URL = 'DATABASE_URL="postgresql://myuser:mypassword@localhost:5925/whitenote?schema=public"'
    REDIS_URL = 'REDIS_URL="redis://localhost:16379"'
    FILE_WATCHER_DIR = 'FILE_WATCHER_DIR=./data/link_md'
}

# Docker 生产模式配置
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

        $config = $DevConfig
        $ModeName = "本地开发"
    }

    "docker" {
        Write-Info "切换到 Docker 生产模式..."
        Write-Warning "切换后请运行: docker-compose up -d"
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
    Write-Host "  1. 启动服务: pnpm dev"
    Write-Host "  2. 启动 Worker: pnpm worker"
    Write-Host "  3. 访问: http://localhost:3005"
} else {
    Write-Info "下一步操作："
    Write-Host "  1. 构建镜像: pnpm docker:dev:build"
    Write-Host "  2. 启动容器: pnpm docker:dev"
    Write-Host "  3. 访问: http://localhost:3005"
}
Write-Host ""
Write-Info "如需恢复原配置，备份文件位于: $BackupFile"
Write-Host ""
Write-Warning "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
