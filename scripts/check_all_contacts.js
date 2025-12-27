const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Listing all contacts...')
    const contacts = await prisma.contact.findMany()
    contacts.forEach(c => {
        console.log(`- ID: ${c.id}, Phone: '${c.phone_whatsapp}'`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
