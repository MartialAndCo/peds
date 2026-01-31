const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- UPDATING WAHA ENDPOINT ---')
    // Get current
    const current = await prisma.setting.findUnique({ where: { key: 'waha_endpoint' } })
    console.log(`Current: ${current?.value}`)

    // Correct it
    // Assuming the IP 13.60.16.81 is correct, just switch port 3000 -> 3001
    // Actually, I should dynamically grab the current IP part just in case.

    if (current && current.value) {
        const newValue = current.value.replace(':3000', ':3001')
        if (newValue !== current.value) {
            const updated = await prisma.setting.update({
                where: { key: 'waha_endpoint' },
                data: { value: newValue }
            })
            console.log(`Updated to: ${updated.value}`)
        } else {
            console.log('Port was not 3000, skipping auto-fix.')
            // If it's already 3001, then checking if it is localhost?
            // But if the user entered it manually, assume IP is correct.
            if (!current.value.includes(':3001')) {
                console.log('WARNING: Port is not 3001. Please check manually.')
            }
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
