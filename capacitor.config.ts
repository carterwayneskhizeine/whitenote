import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.goldierill.whitenote',
  appName: 'WhiteNote',
  webDir: 'mobile-www',
  server: {
    // APK 打开后直接加载线上站点（登录态/Socket.IO/上传全部走同源，照旧）
    url: 'https://whitenote.goldierill.com',
    cleartext: false,
  },
};

export default config;
