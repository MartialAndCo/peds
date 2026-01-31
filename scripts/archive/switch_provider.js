const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- CHECKING API KEYS ---')
    const settings = await prisma.setting.findMany()

    const veniceKey = settings.find(s => s.key === 'venice_api_key')?.value
    const anthropicKey = settings.find(s => s.key === 'anthropic_api_key')?.value
    const activeProvider = settings.find(s => s.key === 'ai_provider')?.value

    console.log(`Active Provider: ${activeProvider}`)
    console.log(`Venice Key present: ${!!veniceKey} (Length: ${veniceKey?.length})`)
    console.log(`Anthropic Key present: ${!!anthropicKey} (Length: ${anthropicKey?.length})`)

    if (activeProvider === 'venice' && anthropicKey) {
        console.log('⚠️ Venice is down (402). Switching to Anthropic...')
        await prisma.setting.update({
            where: { key: 'ai_provider' },
            data: { value: 'anthropic' }
        })
        console.log('✅ Provider switched to Anthropic.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
