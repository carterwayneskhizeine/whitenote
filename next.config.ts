import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 只在生产环境使用 standalone 模式（Docker 部署）
  // 本地开发时不设置此选项
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' as const } : {}),
  images: {
    unoptimized: true,
  },
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
