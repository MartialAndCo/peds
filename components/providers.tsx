'use-client'
"use client"

import { StatusProvider } from "@/components/waha-status-provider";
import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <StatusProvider>
                {children}
            </StatusProvider>
        </SessionProvider>
    )
}
