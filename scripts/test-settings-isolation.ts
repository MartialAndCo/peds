import { prisma } from '../lib/prisma'
import { director } from '../lib/director'

async function main() {
    console.log('--- TESTING SETTINGS ISOLATION ---')

    // 1. Setup Data
    const agentA = await prisma.agent.findFirst({ orderBy: { id: 'asc' } })
    if (!agentA) throw new Error('No agent found to test')

    console.log(`Using Agent A: ${agentA.name} (ID: ${agentA.id})`)

    // 2. Clear existing payment settings for Agent A
    await prisma.agentSetting.deleteMany({
        where: {
            agentId: agentA.id,
            key: { startsWith: 'payment_' }
        }
    })

    // 3. Simulate UI Save (Write to AgentSetting)
    console.log('Simulating UI Save for Agent A (PayPal Enabled)...')
    await prisma.agentSetting.create({
        data: {
            agentId: agentA.id,
            key: 'payment_paypal_enabled',
            value: 'true'
        }
    })
    await prisma.agentSetting.create({
        data: {
            agentId: agentA.id,
            key: 'payment_paypal_username',
            value: 'test_paypal@agent.com'
        }
    })

    // 4. Verify Global Settings are UNTOUCHED
    console.log('Verifying Global Settings...')
    const globalPaypal = await prisma.setting.findUnique({
        where: { key: 'payment_paypal_enabled' }
    })
    const globalUser = await prisma.setting.findUnique({
        where: { key: 'payment_paypal_username' }
    })

    console.log(`Global PayPal Enabled: ${globalPaypal?.value || 'undefined'}`)
    console.log(`Global PayPal Username: ${globalUser?.value || 'undefined'}`)

    if (globalPaypal?.value === 'true' || globalUser?.value === 'test_paypal@agent.com') {
        console.error('FAIL: Global settings were overwritten!')
    } else {
        console.log('PASS: Global settings are safe.')
    }

    // 5. Verify Director Read (Strict Isolation)
    console.log('Verifying Director Output...')

    // Create dummy contact for director call
    const contact = await prisma.contact.findFirst() || await prisma.contact.create({ data: { phone_whatsapp: '1234567890' } });

    // Dummy global settings (passed to director, simulating cache)
    const dummyGlobalSettings = { payment_paypal_enabled: 'false', payment_paypal_username: 'global@fail.com' }

    const prompt = await director.buildSystemPrompt(
        dummyGlobalSettings, // Passing global settings that SHOULD BE IGNORED
        contact,
        'CONNECTION',
        { trustScore: 0 },
        'Role: Assistant',
        agentA.id
    )

    if (prompt.includes('test_paypal@agent.com')) {
        console.log('PASS: Director used Agent A settings.')
    } else {
        console.error('FAIL: Director did NOT use Agent A settings.')
        console.log('Prompt Content:', prompt.substring(prompt.indexOf('PAYMENT')))
    }

    if (prompt.includes('global@fail.com')) {
        console.error('FAIL: Director leaked Global settings!')
    } else {
        console.log('PASS: Director ignored Global settings.')
    }

    console.log('--- TEST COMPLETE ---')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
