import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import Credentials from "next-auth/providers/credentials"
import prisma from "./prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          return null
        }

        // 使用 Prisma 事务创建 AiConfig 和默认 Workspace
        await prisma.$transaction(async (tx) => {
          // 创建 AiConfig（如果不存在）
          let aiConfig = await tx.aiConfig.findUnique({
            where: { userId: user.id }
          })

          if (!aiConfig) {
            aiConfig = await tx.aiConfig.create({
              data: { userId: user.id }
            })
          }

          // 检查是否已有默认 Workspace
          const existingWorkspace = await tx.workspace.findFirst({
            where: { userId: user.id, isDefault: true }
          })

          if (!existingWorkspace) {
            await tx.workspace.create({
              data: {
                name: '默认',
                isDefault: true,
                userId: user.id,
                // RAGFlow 资源稍后由用户在设置中配置后创建
              }
            })
          }
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.image = user.image
      }
      // Handle session update from useSession().update()
      if (trigger === "update" && session?.user) {
        token.name = session.user.name
        token.image = session.user.image
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.image = token.image as string | null | undefined
      }
      return session
    },
  },
})
