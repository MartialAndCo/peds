import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    debug: true, // Always debug for now to fix prod
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
                console.log("Authorize called with email:", credentials?.email)
                if (!credentials?.email || !credentials?.password) {
                    console.log("Missing credentials")
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email,
                    },
                })

                if (!user) {
                    console.log("User not found in DB")
                    return null
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                )

                if (!isPasswordValid) {
                    console.log("Invalid password")
                    return null
                }

                console.log("Login successful for user:", user.email)
                return {
                    id: user.id,
                    email: user.email,
                }
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token) {
                session.user = {
                    ...session.user,
                    email: token.email,
                }
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.email = user.email
            }
            return token
        },
    },
}
