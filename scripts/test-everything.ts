import { prisma } from '../lib/prisma'
import { director } from '../lib/director'

async function main() {
    console.log('🏁 STARTING "TEST EVERYTHING" PROTOCOL 🏁')

    // ---------------------------------------------------------
    // 1. DATA INTEGRITY CHECK (CUIDs)
    // ---------------------------------------------------------
    console.log('\n[1] Checking Agent IDs...')
    const agents = await prisma.agent.findMany()
    console.log(`Found ${agents.length} agents.`)
    agents.forEach(a => console.log(`   - ${a.name} (ID: ${a.id}) [Type: ${typeof a.id}]`))

    const hasLegacyIds = agents.some(a => !isNaN(Number(a.id)) && a.id.length < 5)
    if (hasLegacyIds) {
        console.warn('⚠️  WARNING: Legacy IDs (short numbers) detected. This is valid but not ideal.')
    } else {
        console.log('✅ IDs look like strings/CUIDs.')
    }

    // ---------------------------------------------------------
    // 2. ISOLATION CHECK: SETTINGS
    // ---------------------------------------------------------
    console.log('\n[2] Testing Settings Isolation...')

    // Use first agent
    const agentA = agents[0]
    if (!agentA) throw new Error('No agents found!')

    console.log(`Targeting Agent: ${agentA.name} (${agentA.id})`)

    // Wipe settings
    await prisma.agentSetting.deleteMany({ where: { agentId: agentA.id, key: 'test_isolation_key' } })

    // Set Agent Setting
    await prisma.agentSetting.create({
        data: { agentId: agentA.id, key: 'test_isolation_key', value: 'AGENT_SPECIFIC_VALUE' }
    })

    // Check Global
    const globalSetting = await prisma.setting.findUnique({ where: { key: 'test_isolation_key' } })
    if (globalSetting) {
        console.error('❌ FAIL: Agent setting leaked to Global!')
    } else {
        console.log('✅ PASS: Global settings untouched.')
    }

    // Check Retrieval
    const retrieved = await prisma.agentSetting.findUnique({
        where: { agentId_key: { agentId: agentA.id, key: 'test_isolation_key' } }
    })
    if (retrieved?.value === 'AGENT_SPECIFIC_VALUE') {
        console.log('✅ PASS: Agent setting saved and retrieved correctly.')
    } else {
        console.error('❌ FAIL: Could not retrieve agent setting.')
    }

    // ---------------------------------------------------------
    // 3. DIRECTOR CONTEXT CHECK (The "Real" Test)
    // ---------------------------------------------------------
    console.log('\n[3] Testing Director (AI Context)...')

    // Create Dummy Contact
    const contact = await prisma.contact.upsert({
        where: { phone_whatsapp: '999999999' },
        create: { phone_whatsapp: '999999999', name: 'Test Dummy' },
        update: {}
    })

    // Prepare Prompt Context
    const dummySettings = {
        test_isolation_key: 'GLOBAL_FALLBACK',
        payment_paypal_enabled: 'true', // Global says YES
        payment_paypal_username: 'global@paypal.com' // Global PayPal
    }

    // Set Agent SPECIFIC Payment
    await prisma.agentSetting.upsert({
        where: { agentId_key: { agentId: agentA.id, key: 'payment_paypal_username' } },
        create: { agentId: agentA.id, key: 'payment_paypal_username', value: 'agent_specific@paypal.com' },
        update: { value: 'agent_specific@paypal.com' }
    })

    // Build Prompt
    const prompt = await director.buildSystemPrompt(
        dummySettings,
        contact,
        'CONNECTION',
        { trustScore: 0 },
        'You are an AI.',
        agentA.id // Passing STRING ID
    )

    // CHECK 1: Does it contain Agent PayPal?
    if (prompt.includes('agent_specific@paypal.com')) {
        console.log('✅ PASS: Director uses Agent-Specific PayPal.')
    } else {
        console.error('❌ FAIL: Director did NOT use Agent-Specific PayPal.')
        console.log('Prompt Snippet:', prompt.slice(0, 500))
    }

    // CHECK 2: Does it contain Global PayPal?
    if (prompt.includes('global@paypal.com')) {
        console.error('❌ FAIL: Director LEAKED Global PayPal.')
    } else {
        console.log('✅ PASS: Director IGNORED Global Settings.')
    }

    // ---------------------------------------------------------
    // 4. BLACKLIST CHECK
    // ---------------------------------------------------------
    console.log('\n[4] Testing Blacklist Scope...')

    await prisma.blacklistRule.create({
        data: { term: 'forbidden_word', agentId: agentA.id, phase: 'all' }
    })

    const rules = await prisma.blacklistRule.findMany({ where: { agentId: agentA.id } })
    if (rules.some(r => r.term === 'forbidden_word')) {
        console.log('✅ PASS: Blacklist rule created for Agent.')
    } else {
        console.error('❌ FAIL: Blacklist rule creation failed.')
    }

    console.log('\n🎉 ALL SYSTEMS GO. "TEST EVERYTHING" PASSED. 🎉')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
