const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
    const email = process.argv[2]
    const password = process.argv[3]

    if (!email || !password) {
        console.log('Usage: node scripts/create_user.js <email> <password>')
        return
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    try {
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
            },
        })
        console.log(`User created: ${user.email}`)
    } catch (e) {
        console.error('Error creating user:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
