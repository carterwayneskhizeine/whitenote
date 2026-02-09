# 带环境检查的开发模式启动脚本

# 先检查环境配置
.\check-env.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Warning "环境配置不正确，已取消启动"
    exit 1
}

# 启动开发服务器
Write-Host ""
Write-Info "启动开发服务器..."
Write-Host ""
pnpm dev
