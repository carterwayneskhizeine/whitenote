# 切换到 Windows 本地开发模式
.\switch-env.ps1 dev

Write-Host ""
Write-Warning "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
