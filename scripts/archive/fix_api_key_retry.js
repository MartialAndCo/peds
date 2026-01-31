const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Force updating waha_api_key...")
    try {
        const result = await prisma.setting.update({
            where: { key: 'waha_api_key' },
            data: { value: 'secret' }
        })
        console.log("Updated (Update):", result)
    } catch (e) {
        if (e.code === 'P2025') {
            const result = await prisma.setting.create({
                data: { key: 'waha_api_key', value: 'secret' }
            })
            console.log("Updated (Create):", result)
        } else {
            throw e
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
