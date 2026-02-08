import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 只在生产环境使用 standalone 模式（Docker 部署）
  // 本地开发时不设置此选项
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' as const } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
