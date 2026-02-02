// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Connection pool configuration to prevent exhaustion
// We systematically unnecessary connection parameters to avoid timeouts in Serverless environment
const getDatabaseUrl = () => {
    const url = process.env.DATABASE_URL
    if (!url) return url
    try {
        // Parse URL to append query params
        // Note: We use string manipulation to avoid issues if the URL scheme is unsupported by URL object (?)
        // Actually, URL object handles postgres:// fine.
        const urlObj = new URL(url)

        // Force higher limits for Serverless (Amplify)
        // Default is often 5-10, we need more for concurrent CRONs
        if (!urlObj.searchParams.has('connection_limit')) {
            urlObj.searchParams.set('connection_limit', '20')
        }
        if (!urlObj.searchParams.has('pool_timeout')) {
            urlObj.searchParams.set('pool_timeout', '30') // 30s wait before throwing timeout
        }
        return urlObj.toString()
    } catch (e) {
        return url // Fallback if URL parsing fails
    }
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: getDatabaseUrl(),
        },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

// Graceful shutdown
if (typeof window === 'undefined') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect()
    })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
