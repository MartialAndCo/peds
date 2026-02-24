const { PrismaClient } = require('@prisma/client')
require('dotenv').config()
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
})

async function main() {
    const email = 'admin@admin.com'
    const password = 'admin'
    const hashedPassword = await bcrypt.hash(password, 10)

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password: hashedPassword,
            },
        })
        console.log('User created:', user)
    } catch (e) {
        console.error('Error creating user:', e)
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
