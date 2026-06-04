import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { findUserByEmail, verifyPassword } from "@/lib/users"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = findUserByEmail(credentials.email)
        if (!user) return null
        const valid = await verifyPassword(credentials.password, user.passwordHash)
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
