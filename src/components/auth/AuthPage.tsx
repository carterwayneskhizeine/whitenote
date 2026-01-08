"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"

type AuthMode = "login" | "register"

export function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("login")

  // Login state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Register state
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        callbackUrl: "/",
        redirect: false,
      })

      if (result?.error) {
        setError("邮箱或密码错误")
        setLoading(false)
      } else if (result?.ok) {
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError("登录失败，请重试")
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await authApi.register({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
    })

    if (result.error) {
      setError(result.error)
    } else {
      // 注册成功后切换到登录模式
      setMode("login")
      setLoginEmail(registerEmail)
      setError("")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" suppressHydrationWarning>
      {/* Left side - Logo */}
      <div className="hidden lg:flex lg:w-1/2 bg-black items-center justify-center p-12">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          className="h-64 w-64 fill-white"
        >
          <polygon points="260.68 64.93 240.51 99.87 240.52 99.89 78.34 380.8 118.75 380.8 260.8 134.76 383.54 345.8 215.64 345.8 272.64 246.42 252.4 211.36 155.22 380.8 185.43 380.8 195.57 380.8 403.89 380.8 419.08 380.8 444.38 380.8 260.68 64.93" />
        </svg>
      </div>

      {/* Right side - Content */}
      <div className="flex-1 flex items-center justify-center p-8 bg-neutral-900">
        <div className="w-full max-w-[600px]">
          {/* Logo for mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="h-16 w-16 fill-white"
            >
              <polygon points="260.68 64.93 240.51 99.87 240.52 99.89 78.34 380.8 118.75 380.8 260.8 134.76 383.54 345.8 215.64 345.8 272.64 246.42 252.4 211.36 155.22 380.8 185.43 380.8 195.57 380.8 403.89 380.8 419.08 380.8 444.38 380.8 260.68 64.93" />
            </svg>
          </div>

          {/* Auth Card */}
          <div className="bg-black border border-gray-800 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-white mb-8">
              {mode === "login" ? "登录" : "创建你的账号"}
            </h2>

            {/* Login Form */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="手机号码、邮件地址或用户名"
                    className="h-12 bg-black border-gray-700 text-white placeholder:text-gray-500 focus:border-white"
                  />
                </div>

                <div>
                  <Input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="密码"
                    className="h-12 bg-black border-gray-700 text-white placeholder:text-gray-500 focus:border-white"
                  />
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-full bg-white hover:bg-gray-200 text-black font-bold"
                >
                  {loading ? "登录中..." : "登录"}
                </Button>

                <div className="text-center text-gray-500 text-sm mt-6">
                  还没有账号？{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="text-blue-400 hover:underline"
                  >
                    注册
                  </button>
                </div>
              </form>
            )}

            {/* Register Form */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                    placeholder="名字"
                    className="h-12 bg-black border-gray-700 text-white placeholder:text-gray-500 focus:border-white"
                  />
                </div>

                <div>
                  <Input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    placeholder="电子邮件"
                    className="h-12 bg-black border-gray-700 text-white placeholder:text-gray-500 focus:border-white"
                  />
                </div>

                <div>
                  <Input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="密码（至少 6 位字符）"
                    className="h-12 bg-black border-gray-700 text-white placeholder:text-gray-500 focus:border-white"
                  />
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-full bg-white hover:bg-gray-200 text-black font-bold"
                >
                  {loading ? "注册中..." : "创建账号"}
                </Button>

                <div className="text-center text-gray-500 text-sm mt-6">
                  已有账号？{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-blue-400 hover:underline"
                  >
                    登录
                  </button>
                </div>
              </form>
            )}

            {/* Test Account Info - Only show on login mode */}
            {mode === "login" && (
              <div className="mt-8 pt-6 border-t border-gray-800">
                <div className="text-sm text-gray-500 space-y-2">
                  <p className="font-medium text-gray-400">测试账号：</p>
                  <div className="bg-neutral-900 p-3 rounded-lg text-xs font-mono space-y-1">
                    <p>邮箱: owner@whitenote.local</p>
                    <p>密码: admin123</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer links */}
          <div className="mt-8 text-center text-xs text-gray-600">
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              <Link href="/about" className="hover:underline">关于</Link>
              <Link href="/download" className="hover:underline">下载应用</Link>
              <Link href="/help" className="hover:underline">帮助中心</Link>
            </div>
            <p>© 2026 WhiteNote</p>
          </div>
        </div>
      </div>
    </div>
  )
}
