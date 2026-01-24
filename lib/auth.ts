import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    debug: true,
    // @ts-ignore
    trustHost: true,
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                    include: { agents: { select: { id: true } } }
                })

                if (!user) return null

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                )

                if (!isPasswordValid) return null

                return {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    agents: user.agents
                } as any
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id
                session.user.role = token.role
                session.user.allowedAgentIds = token.allowedAgentIds
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role
                token.allowedAgentIds = user.agents?.map(a => a.id) || []
            }
            return token
        },
    },
}
