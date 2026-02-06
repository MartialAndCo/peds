import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface User {
        role: "ADMIN" | "COLLABORATOR" | "PROVIDER"
        agents?: { id: number }[]
    }

    interface Session {
        user: {
            id: string
            role: "ADMIN" | "COLLABORATOR" | "PROVIDER"
            allowedAgentIds: number[]
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: "ADMIN" | "COLLABORATOR" | "PROVIDER"
        allowedAgentIds: number[]
    }
}
