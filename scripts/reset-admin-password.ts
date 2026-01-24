
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetAdmin() {
    const email = 'admin@admin.com'
    const password = 'password' // Default, change if needed
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log(`Resetting admin user: ${email}`)

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                role: 'ADMIN' // Ensure role is set
            },
            create: {
                email,
                password: hashedPassword,
                role: 'ADMIN'
            }
        })
        console.log('Admin user reset successfully:', user)
    } catch (e) {
        console.error('Error resetting admin:', e)
    } finally {
        await prisma.$disconnect()
    }
}

resetAdmin()
