// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Connection pool configuration to prevent exhaustion
export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
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
