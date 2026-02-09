<#
.SYNOPSIS
    快速切换到 Docker 生产模式

.DESCRIPTION
    从 Windows 本地开发模式切换到 Docker 生产模式

    【切换前准备】
    1. 停止所有本地服务
       → Ctrl+C (停止 pnpm dev)
       → Ctrl+C (停止 pnpm worker)

    2. 提交代码更改
       → git add .
       → git commit -m "Prepare for Docker deployment"

    3. 确保环境变量正确
       → .\check-env.ps1

    【切换后需要做的事情】
    1. 清理构建缓存
       → rm -rf .next

    2. 重新构建项目
       → pnpm build

    3. 构建 Docker 镜像
       → pnpm docker:dev:build

    4. 启动 Docker 服务
       → pnpm docker:dev

    5. 访问应用
       → http://localhost:3005

    【常见问题】
    - 构建失败？
      → 确保 NODE_ENV=production
      → 检查 Docker 容器日志: docker-compose logs

    - 端口冲突？
      → 检查端口占用: netstat -ano | findstr :3005
      → 停止占用端口的进程

    【回滚】
    如需回滚到本地开发，运行: .\switch-to-dev.ps1

.EXAMPLE
    .\switch-to-docker.ps1
#>

# 切换到 Docker 生产模式
.\switch-env.ps1 docker

Write-Host ""
Write-Warning "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
