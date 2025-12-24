import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    // Safe check of env vars (do not expose full secret values)
    const envStatus = {
        DATABASE_URL: process.env.DATABASE_URL ? "Set (Starts with " + process.env.DATABASE_URL.substring(0, 10) + "...)" : "Missing",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "Set" : "Missing",
        NODE_ENV: process.env.NODE_ENV,
    }

    try {
        // Test DB Connection
        const userCount = await prisma.user.count()

        return NextResponse.json({
            status: 'ok',
            env: envStatus,
            db_connection: 'success',
            user_count: userCount
        })
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            env: envStatus, // Return env status even on error
            message: error.message,
            stack: error.stack
        }, { status: 500 })
    }
}
