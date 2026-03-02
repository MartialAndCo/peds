'use-client'
"use client"

import { StatusProvider } from "@/components/waha-status-provider";
import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <StatusProvider>
                {children}
                <Toaster richColors position="bottom-right" />
            </StatusProvider>
        </SessionProvider>
    )
}
