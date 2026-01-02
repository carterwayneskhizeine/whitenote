import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-zinc-900 mb-4">WhiteNote</h1>
          <p className="text-xl text-zinc-600">
            伪装成 Twitter 时间线的 AI 知识管理系统
          </p>
        </div>

        {/* 用户状态显示 */}
        {session?.user ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <p className="text-green-800 font-medium">
              ✅ 已登录: {session.user.email}
            </p>
            <p className="text-sm text-green-600 mt-1">
              用户 ID: {session.user.id}
            </p>
            <form action="/api/auth/signout" method="POST" className="mt-3">
              <button
                type="submit"
                className="text-sm text-green-700 hover:text-green-900 underline"
              >
                退出登录
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <p className="text-yellow-800">ℹ️ 未登录状态</p>
            <p className="text-sm text-yellow-600 mt-1">
              登录后可以测试 Messages API
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-4">
              <div className="text-3xl mb-2">📝</div>
              <h3 className="font-semibold text-zinc-900 mb-1">时间线记录</h3>
              <p className="text-sm text-zinc-600">类似 Twitter 的碎片化知识记录体验</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="font-semibold text-zinc-900 mb-1">AI 助手</h3>
              <p className="text-sm text-zinc-600">自动打标、每日晨报、智能检索</p>
            </div>
            <div className="p-4">
              <div className="text-3xl mb-2">🔗</div>
              <h3 className="font-semibold text-zinc-900 mb-1">双向链接</h3>
              <p className="text-sm text-zinc-600">类似 Obsidian 的知识图谱网络</p>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {!session?.user ? (
            <>
              <Link
                href="/login"
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="px-8 py-3 bg-white text-zinc-900 rounded-lg hover:bg-zinc-50 font-medium transition-colors border border-zinc-300"
              >
                注册账号
              </Link>
            </>
          ) : (
            <Link
              href="/test-api.html"
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors text-lg"
            >
              🧪 测试 Messages API
            </Link>
          )}
        </div>

        <div className="mt-8 text-sm text-zinc-500">
          <p>当前阶段: Messages API ✅ | 待实现: Tags, Comments, Templates</p>
          <p className="mt-1">服务器端口: 3005</p>
        </div>
      </div>
    </div>
  );
}
