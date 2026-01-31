
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Agent Settings (AI Provider) ---')
    const agentSettings = await prisma.agentSetting.findMany({
        where: { key: 'ai_provider' }
    })
    console.log('Found:', agentSettings)

    // Fix: Update all agent settings from venice to openrouter
    if (agentSettings.some(s => s.value === 'venice')) {
        console.log('\n[FIX] Updating venice -> openrouter...')
        await prisma.agentSetting.updateMany({
            where: { key: 'ai_provider', value: 'venice' },
            data: { value: 'openrouter' }
        })
        console.log('[FIX] Done!')
    } else {
        console.log('[OK] No venice settings found.')
    }

    // Also check global setting
    console.log('\n--- Global Settings (AI Provider) ---')
    const globalProvider = await prisma.setting.findFirst({
        where: { key: 'ai_provider' }
    })
    console.log('Global ai_provider:', globalProvider)

    if (globalProvider?.value === 'venice') {
        console.log('\n[FIX] Updating global venice -> openrouter...')
        await prisma.setting.update({
            where: { id: globalProvider.id },
            data: { value: 'openrouter' }
        })
        console.log('[FIX] Done!')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
