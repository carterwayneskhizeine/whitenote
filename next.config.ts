import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 只在生产环境使用 standalone 模式（Docker 部署）
  // 本地开发时不设置此选项
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' as const } : {}),
  images: {
    unoptimized: true,
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
