/**
 * Integration Test for Life Context in System Prompt
 * Verifies that director.buildSystemPrompt correctly injects life context
 */

import { director } from '../lib/director'
import { prisma } from '../lib/prisma'

async function testLifeContextIntegration() {
    console.log('═'.repeat(80))
    console.log('🔗 INTEGRATION TEST: Life Context in System Prompt')
    console.log('═'.repeat(80))
    console.log()

    // Mock test data
    const mockAgentId = 'test-agent-lena'
    const mockContact = {
        id: 999,
        name: 'TestUser',
        phone_whatsapp: '+33600000000',
        notes: 'Test contact notes'
    }

    const mockSettings = {}
    const mockPhase = 'CONNECTION' as const
    const mockDetails = {
        signals: [],
        signalCount: 0,
        trustScore: 0
    }
    const mockBaseRole = 'Tu es Lena, une ado de 15 ans'

    try {
        console.log('📝 Building system prompt with life context injection...')
        console.log()

        // Call buildSystemPrompt
        const systemPrompt = await director.buildSystemPrompt(
            mockSettings,
            mockContact,
            mockPhase,
            mockDetails,
            mockBaseRole,
            mockAgentId,
            'Test progression'
        )

        // Check that life context is present
        const hasLifeContext = systemPrompt.includes('[CONTEXTE VIE ACTUEL')
        const hasTimeReference = systemPrompt.match(/\d{2}:\d{2}/)

        console.log('✅ System prompt built successfully')
        console.log()

        // Extract and display the life context section
        const lifeContextMatch = systemPrompt.match(/\[CONTEXTE VIE ACTUEL[^\]]+\]:[^\n]+/)
        if (lifeContextMatch) {
            console.log('📍 Extracted Life Context from prompt:')
            console.log('   ' + lifeContextMatch[0])
            console.log()
        }

        // Verify injection
        console.log('🔍 Verification:')
        console.log('   - Life context marker present:', hasLifeContext ? '✅ YES' : '❌ NO')
        console.log('   - Time reference found:', hasTimeReference ? '✅ YES (' + hasTimeReference[0] + ')' : '❌ NO')
        console.log()

        // Check that prompt contains expected structure
        const checks = [
            { name: 'System instructions header', pattern: /### SYSTEM INSTRUCTIONS/ },
            { name: 'Identity section', pattern: /1\. IDENTITY|Role:/ },
            { name: 'Context section', pattern: /2\. CONTEXT|User:/ },
            { name: 'Life context (NEW)', pattern: /\[CONTEXTE VIE ACTUEL/ },
            { name: 'Mission section', pattern: /3\. MISSION|PHASE:/ },
            { name: 'Critical rules', pattern: /RÈGLES CRITIQUES|CRITICAL RULES/ }
        ]

        console.log('📋 Prompt Structure Check:')
        let allPassed = true
        for (const check of checks) {
            const passed = check.pattern.test(systemPrompt)
            console.log(`   ${passed ? '✅' : '❌'} ${check.name}`)
            if (!passed) allPassed = false
        }
        console.log()

        // Show prompt length
        console.log(`📊 Prompt Statistics:`)
        console.log(`   - Total length: ${systemPrompt.length} characters`)
        console.log(`   - Line count: ${systemPrompt.split('\n').length} lines`)
        console.log()

        // Show first 500 chars of prompt
        console.log('📝 Prompt Preview (first 800 chars):')
        console.log('-'.repeat(80))
        console.log(systemPrompt.substring(0, 800))
        console.log('-'.repeat(80))
        console.log('... (truncated)')
        console.log()

        if (allPassed && hasLifeContext) {
            console.log('✅✅✅ ALL INTEGRATION TESTS PASSED ✅✅✅')
            console.log()
            console.log('🎯 The life context is now correctly injected into the system prompt!')
            console.log('   The AI will know what time it is and what she\'s doing.')
            return true
        } else {
            console.log('❌❌❌ SOME TESTS FAILED ❌❌❌')
            return false
        }

    } catch (error) {
        console.error('❌ Error during integration test:', error)
        console.log()
        console.log('Note: This test requires a valid agent profile in the database.')
        console.log('Make sure agent "lena" exists with proper profile settings.')
        return false
    }
}

// Run the test
testLifeContextIntegration()
    .then(success => {
        process.exit(success ? 0 : 1)
    })
    .catch(error => {
        console.error('Unhandled error:', error)
        process.exit(1)
    })
