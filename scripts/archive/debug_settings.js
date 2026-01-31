const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- DEBUG SETTINGS ---')
    const settings = await prisma.setting.findMany()

    // Group by key
    settings.forEach(s => {
        if (s.key.includes('prompt') || s.key.includes('phase')) {
            console.log(`\n[${s.key}]:`)
            console.log(s.value)
            console.log('-----------------------------------')
        }
    })

    console.log('\n--- CHECKING CONTACT PHASE ---')
    const contacts = await prisma.contact.findMany()
    contacts.forEach(c => {
        console.log(`Contact ${c.phone_whatsapp}: Phase=${c.agentPhase}, Trust=${c.trustScore}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
