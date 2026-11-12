import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 注意：不要开 output: 'standalone'——本项目生产方式是 `pnpm start`（tsx server.ts），
  // 不消费 standalone 产物；开着会让每次构建额外复制 107MB，并在启动时警告
  // "next start does not work with output: standalone"。
  // 若将来恢复 Docker 部署，再在 Docker 构建阶段单独加回这一项。
  images: {
    unoptimized: true,
  },
  // 开发模式下通过 Cloudflare 隧道域名访问时，Next.js 16 会拦截跨域的
  // /_next/* 资源请求（当前仅警告，后续主版本会真正阻断），显式放行。
  allowedDevOrigins: ["whitenote.goldierill.com"],
  // sync-utils.ts 里运行时拼接的 fs 路径会让 Turbopack 静态追踪推导出过宽的 glob，
  // 把 src/、docs/、data/、.env、cookies.txt 等整个项目目录 trace 进 standalone 产物。
  // Docker 部署时 data 走 FILE_WATCHER_DIR 卷挂载，这些文件都不需要打进镜像。
  outputFileTracingExcludes: {
    "/**/*": [
      "./data/**",
      "./src/**",
      "./test/**",
      "./docs/**",
      "./openwiki/**",
      "./HttpAPIRAGFlow/**",
      "./scripts/**",
      "./logs/**",
      "./backups/**",
      "./.env",
      "./.env.*",
      "./cookies.txt",
      "./*.md",
      "./tsconfig.tsbuildinfo",
    ],
  },
  // native addons 必须排除在 bundle 外，否则 standalone 模式下 require.resolve 被破坏
  serverExternalPackages: [
    'better-sqlite3',
    'sqlite-vec',
    'sqlite-vec-windows-x64',
  ],
  // 配置 Turbopack
  turbopack: {
    // 不需要特殊配置
  },
} as NextConfig;

export default nextConfig;
