# 检查当前环境配置是否正确
$ErrorActionPreference = "Stop"

$EnvFile = ".env"
$Content = Get-Content $EnvFile -Raw

# 检查 NODE_ENV
if ($Content -match '^NODE_ENV=production') {
    Write-Host ""
    Write-Warning "⚠ 当前是 Docker 生产模式配置！"
    Write-Warning "本地开发请先运行: .\switch-to-dev.ps1"
    Write-Host ""

    $response = Read-Host "是否现在切换到开发模式？(Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        .\switch-to-dev.ps1
    }
    exit 1
} else {
    Write-Host ""
    Write-Host "✓ 当前配置正确（本地开发模式）" -ForegroundColor Green
    Write-Host ""
    exit 0
}
