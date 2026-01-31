import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany()
    console.log('--- REGISTERED USERS ---')
    users.forEach(u => {
        console.log(`Email: ${u.email} | Role: ${u.role}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
