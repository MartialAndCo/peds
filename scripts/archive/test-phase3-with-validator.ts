import { PrismaClient } from '@prisma/client'
import { director } from '../lib/director'
import { venice } from '../lib/venice'
import { messageValidator } from '../lib/services/message-validator'

const prisma = new PrismaClient()

interface Message {
    sender: 'user' | 'ai'
    text: string
    issues?: string[]
    validatorUsed?: boolean
}

async function simulatePhase3() {
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║       PHASE 3 TEST - AVEC AI VALIDATOR INTÉGRÉ                ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')

    const settings = await prisma.settings.findMany()
    const settingsObj = Object.fromEntries(settings.map(s => [s.key, s.value]))

    const agent = await prisma.agent.findFirst({
        where: { name: 'Lena' },
        include: { profile: true }
    })

    if (!agent) {
        console.error('❌ Agent Lena not found')
        await prisma.$disconnect()
        return
    }

    // Mock contact for Phase 3
    const mockContact = {
        id: 9999,
        phone_whatsapp: '+1234567890',
        firstName: 'Marc',
        lastName: 'Test',
        trustScore: 65,
        testMode: true
    }

    const conversation: Message[] = []
    const userMessages = [
        "hey what's up?",
        "you seem stressed, everything ok?",
        "what happened?",
        "oh no that sucks",
        "is there anything i can do to help?",
        "no really i want to help",
        "how much do you need?",
        "what's your paypal?",
        "okay i'm sending it now",
        "sent!"
    ]

    console.log('💬 CONVERSATION:\n')
    console.log('─'.repeat(70) + '\n')

    for (let i = 0; i < userMessages.length; i++) {
        const userMsg = userMessages[i]
        conversation.push({ sender: 'user', text: userMsg })

        console.log(`${i + 1}. 👨 Marc: "${userMsg}"`)

        // Build system prompt
        const phase = 'crisis' as const
        const details = {
            reason: 'Phone getting cut off, mom can\'t pay bill',
            amount: 60,
            paymentMethods: ['paypal: lena9200']
        }

        const systemPrompt = await director.buildSystemPrompt(
            settingsObj,
            mockContact,
            phase,
            details,
            'You are Lena',
            agent.id,
            'Financial crisis - phone bill due'
        )

        // Build message history for Venice
        const historyForVenice = conversation.map(m => ({
            role: m.sender === 'user' ? 'user' : 'ai',
            content: m.text
        }))

        // Generate AI response (RAW)
        console.log(`[Venice] Requesting completion...`)
        const rawResponse = await venice.chatCompletion(
            systemPrompt,
            historyForVenice.slice(0, -1),
            userMsg,
            {
                temperature: 0.7,
                max_tokens: 500
            }
        )

        console.log(`[Venice] Raw response: "${rawResponse}"`)

        // Validate and clean with AI validator
        const historyForValidator = conversation.slice(-5).map(m => ({
            sender: m.sender,
            text: m.text
        }))

        let finalResponse = rawResponse
        try {
            finalResponse = await messageValidator.validateAndClean(
                rawResponse,
                historyForValidator,
                userMsg
            )
            console.log(`[Validator] ✅ Cleaned: "${finalResponse}"`)
        } catch (error: any) {
            console.log(`[Validator] ⚠️  Failed, using mechanical fallback`)
            finalResponse = messageValidator.mechanicalClean(rawResponse, userMsg)
        }

        // Analyze issues
        const issues: string[] = []
        let validatorMadeChanges = finalResponse !== rawResponse

        // Check length (count words, excluding emojis and |)
        const segments = finalResponse.split('|').map(s => s.trim())
        segments.forEach((segment, idx) => {
            const words = segment.split(/\s+/).filter(w =>
                w.length > 0 && !w.match(/^[😭😊💖🥺👀🏠🤷😅😞]+$/)
            )
            if (words.length > 8) {
                issues.push(`Segment ${idx + 1}: ${words.length} words (max 8)`)
            }
        })

        // Check formatting
        if (finalResponse.includes('**')) {
            issues.push('Bold detected')
        }
        if (finalResponse.match(/\[(?!PAYMENT_RECEIVED)[^\]]+\]/)) {
            issues.push('Brackets detected')
        }

        // Check PayPal format
        if (finalResponse.match(/paypal:\s*\w+/i)) {
            issues.push('Robotic PayPal format')
        }

        // Check [PAYMENT_RECEIVED] timing
        const hasPastTense = /\b(sent|done|just sent)\b/i.test(userMsg)
        const hasFutureTense = /\b(sending|gonna|will send)\b/i.test(userMsg)

        if (finalResponse.includes('[PAYMENT_RECEIVED]')) {
            if (hasFutureTense || !hasPastTense) {
                issues.push('[PAYMENT_RECEIVED] too early')
            } else {
                issues.push('✅ [PAYMENT_RECEIVED] correct timing')
            }
        }

        // Strip [PAYMENT_RECEIVED] for display (simulating what chat.ts does)
        const displayResponse = finalResponse.replace(/\[PAYMENT_RECEIVED\]/g, '').trim()

        console.log(`   👧 Lena: "${displayResponse}"`)
        if (validatorMadeChanges) {
            console.log(`   🤖 Validator: ACTIVE (cleaned message)`)
        }
        if (issues.length > 0) {
            issues.forEach(issue => {
                if (issue.startsWith('✅')) {
                    console.log(`   ${issue}`)
                } else {
                    console.log(`   ❌ ${issue}`)
                }
            })
        }
        console.log()

        conversation.push({
            sender: 'ai',
            text: finalResponse,
            issues,
            validatorUsed: validatorMadeChanges
        })
    }

    console.log('\n' + '═'.repeat(70))
    console.log('📊 RÉSULTATS FINAUX')
    console.log('═'.repeat(70) + '\n')

    const aiMessages = conversation.filter(m => m.sender === 'ai')
    const totalIssues = aiMessages.reduce((sum, m) => sum + (m.issues?.length || 0), 0)
    const successMessages = aiMessages.filter(m => (m.issues?.length || 0) === 0).length
    const validatorActiveCount = aiMessages.filter(m => m.validatorUsed).length

    // Calculate average words per message
    let totalWords = 0
    let totalSegments = 0
    aiMessages.forEach(m => {
        const segments = m.text.split('|').map(s => s.trim())
        segments.forEach(segment => {
            const words = segment.split(/\s+/).filter(w =>
                w.length > 0 && !w.match(/^[😭😊💖🥺👀🏠🤷😅😞|]+$/)
            )
            totalWords += words.length
            totalSegments++
        })
    })
    const avgWords = Math.round(totalWords / totalSegments)

    console.log('📈 BRIÈVETÉ:')
    console.log(`   Messages: ${aiMessages.length}`)
    console.log(`   Moyenne: ${avgWords} mots/segment`)
    console.log(`   Objectif: 3-8 mots`)
    console.log(`   ${avgWords <= 8 ? '✅' : '❌'}\n`)

    console.log('🤖 VALIDATOR:')
    console.log(`   Activé: ${validatorActiveCount}/${aiMessages.length} messages`)
    console.log(`   Taux: ${Math.round((validatorActiveCount / aiMessages.length) * 100)}%\n`)

    console.log('✅ SUCCÈS:')
    console.log(`   ${successMessages} messages parfaits\n`)

    console.log('❌ ISSUES:')
    console.log(`   ${totalIssues} problèmes détectés\n`)

    const successRate = Math.round((successMessages / aiMessages.length) * 100)
    console.log('🎯 SCORE GLOBAL:')
    if (successRate >= 80) {
        console.log(`   ✅ EXCELLENT (${successRate}%)\n`)
    } else if (successRate >= 60) {
        console.log(`   ✓ BON (${successRate}%)\n`)
    } else {
        console.log(`   ❌ BESOIN D'AMÉLIORATION (${successRate}%)\n`)
    }

    await prisma.$disconnect()
}

simulatePhase3().catch(console.error)
