/**
 * Test Memory Extraction
 * Diagnose and fix memory issues
 */

import { memoryExtractionService } from '@/lib/services/memory-extraction'
import { memoryService } from '@/lib/memory'
import { prisma } from '@/lib/prisma'

async function testMemorySystem() {
    console.log('═'.repeat(60))
    console.log('🔍 MEMORY SYSTEM DIAGNOSTIC')
    console.log('═'.repeat(60))

    // 1. Check Mem0 API Key
    console.log('\n📋 1. Checking Mem0 API Key...')
    const settings = await prisma.setting.findUnique({ where: { key: 'mem0_api_key' } })
    const envKey = process.env.MEM0_API_KEY
    
    if (settings?.value) {
        console.log('   ✅ Mem0 API Key found in DB settings')
    } else if (envKey) {
        console.log('   ✅ Mem0 API Key found in ENV')
    } else {
        console.log('   ❌ Mem0 API Key NOT FOUND!')
        console.log('   💡 Fix: Add MEM0_API_KEY to .env or set mem0_api_key in DB settings')
    }

    // 2. Check active conversations
    console.log('\n📋 2. Checking Active Conversations...')
    const conversations = await prisma.conversation.findMany({
        where: { status: { in: ['active', 'paused'] } },
        include: {
            contact: true,
            agent: true,
            messages: { orderBy: { timestamp: 'desc' }, take: 5 }
        }
    })
    console.log(`   Found ${conversations.length} active/paused conversations`)

    for (const conv of conversations.slice(0, 3)) {
        console.log(`   - ${conv.contact.phone_whatsapp} (Agent: ${conv.agent.name}, Messages: ${conv.messages.length})`)
    }

    // 3. Check messages that should be extracted
    console.log('\n📋 3. Checking Messages for Extraction...')
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    
    for (const conv of conversations.slice(0, 3)) {
        const lastExtraction = conv.lastMemoryExtraction
        const newMessages = conv.messages.filter(m => 
            new Date(m.timestamp) > (lastExtraction || new Date(0))
        )
        
        console.log(`   ${conv.contact.phone_whatsapp}:`)
        console.log(`     - Last extraction: ${lastExtraction || 'Never'}`)
        console.log(`     - New messages since: ${newMessages.length}`)
        
        if (newMessages.length > 0) {
            console.log(`     - Sample: "${newMessages[0].message_text.substring(0, 50)}..."`)
        }
    }

    // 4. Try to run extraction
    console.log('\n📋 4. Running Memory Extraction...')
    try {
        const result = await memoryExtractionService.runExtraction()
        console.log(`   ✅ Extraction complete!`)
        console.log(`   - Conversations processed: ${result.processed}`)
        console.log(`   - Facts extracted: ${result.factsExtracted}`)
    } catch (e: any) {
        console.log(`   ❌ Extraction failed: ${e.message}`)
    }

    // 5. Check existing memories
    console.log('\n📋 5. Checking Existing Memories...')
    for (const conv of conversations.slice(0, 3)) {
        try {
            const userId = memoryService.buildUserId(conv.contact.phone_whatsapp, conv.agentId as unknown as string)
            const memories = await memoryService.getAll(userId)
            console.log(`   ${conv.contact.phone_whatsapp}: ${memories.length} memories`)
            if (memories.length > 0) {
                const sample = memories[0]
                const text = typeof sample === 'string' ? sample : sample.memory
                console.log(`     - Sample: "${text?.substring(0, 60)}..."`)
            }
        } catch (e: any) {
            console.log(`   ${conv.contact.phone_whatsapp}: Error - ${e.message}`)
        }
    }

    // 6. Check AI Mode
    console.log('\n📋 6. Checking AI Mode...')
    const aiMode = await prisma.setting.findUnique({ where: { key: 'ai_mode' } })
    console.log(`   Current mode: ${aiMode?.value || 'CLASSIC (default)'}`)
    if (aiMode?.value === 'SWARM') {
        console.log('   ⚠️  SWARM mode was active - memories were NOT loaded before the fix!')
        console.log('   ✅ Fix applied in lib/swarm/index.ts - memories now loaded')
    }

    console.log('\n' + '═'.repeat(60))
    console.log('🏁 Diagnostic Complete')
    console.log('═'.repeat(60))
}

testMemorySystem()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Diagnostic failed:', e)
        process.exit(1)
    })
