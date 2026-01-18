// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Pass explicit URL from environment if needed to satisfy Prisma 7 requirement?
// Or try empty first. If empty fails in Next.js, we know it's a general issue.
// We'll trust process.env.DATABASE_URL is loaded by Next.js automatically.
// But if constructor requires options...
// Let's try passing the log option to satisfy "non-empty" check if that's really the issue.
const url = process.env.DATABASE_URL;

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: url,
        },
    },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
