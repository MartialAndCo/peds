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

        // Conservative limits to prevent connection exhaustion
        // PostgreSQL default max_connections is 100, we need to stay well below
        if (!urlObj.searchParams.has('connection_limit')) {
            urlObj.searchParams.set('connection_limit', '5')
        }
        if (!urlObj.searchParams.has('pool_timeout')) {
            urlObj.searchParams.set('pool_timeout', '10') // 10s wait before throwing timeout
        }
        if (!urlObj.searchParams.has('idle_timeout')) {
            urlObj.searchParams.set('idle_timeout', '30') // Close idle connections after 30s
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
