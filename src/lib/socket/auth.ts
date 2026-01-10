import { jwtDecrypt } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""
)

/**
 * Verify NextAuth JWT session token and return user data
 */
export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtDecrypt(token, JWT_SECRET, {
      algorithms: ["dir"],
    })

    // NextAuth v5 stores user data in the JWT payload
    // The structure is: { user: { id, email, name, image }, exp, iat }
    const user = payload.user as {
      id: string
      email: string
      name?: string | null
      image?: string | null
    } | undefined

    if (!user?.id) {
      return null
    }

    // Check if token has expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatar: user.image,
    }
  } catch (error) {
    console.error("[Socket] Failed to verify token:", error)
    return null
  }
}
