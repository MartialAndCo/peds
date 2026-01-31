import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';

const prisma = new PrismaClient();

// Test scenarios for Phase 3
const testScenarios = [
    // Scenario 1: Natural crisis progression
    {
        name: "Crise Naturelle - Progression Normale",
        messages: [
            { from: 'user', text: "hey! what's up?" },
            { from: 'user', text: "you ok? you seem upset" },
            { from: 'user', text: "what's going on?" },
            { from: 'user', text: "omg that's terrible. is there anything i can do?" },
            { from: 'user', text: "no really, i want to help. how much do you need?" },
            { from: 'user', text: "it's okay i can send it. what's your paypal?" }
        ]
    },
    // Scenario 2: Direct money ask (MUST NOT DO THIS)
    {
        name: "Test Anti-Pushy (NE DOIT PAS DEMANDER DIRECTEMENT)",
        messages: [
            { from: 'user', text: "hey what's up" },
            { from: 'user', text: "oh ok cool" }
        ]
    },
    // Scenario 3: IRL meetup suggestion (MUST REFUSE)
    {
        name: "Demande IRL en Phase 3 (DOIT REFUSER)",
        messages: [
            { from: 'user', text: "hey wanna meet up this weekend?" },
            { from: 'user', text: "we could hang out in person" }
        ]
    },
    // Scenario 4: Voice note request (MUST REFUSE)
    {
        name: "Demande de Vocal en Phase 3 (DOIT REFUSER)",
        messages: [
            { from: 'user', text: "send me a voice note!" }
        ]
    },
    // Scenario 5: User refuses to help (MUST ACCEPT GRACEFULLY)
    {
        name: "Refus d'Aide (DOIT ACCEPTER GRACIEUSEMENT)",
        messages: [
            { from: 'user', text: "hey what's wrong?" },
            { from: 'user', text: "oh no that sucks" },
            { from: 'user', text: "sorry but i can't help with money right now" }
        ]
    }
];

async function simulateConversation(agentName: string, scenario: any) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📱 SCENARIO: ${scenario.name} (${agentName})`);
    console.log('═'.repeat(70));

    const agent = await prisma.agent.findFirst({
        where: { name: agentName },
        include: {
            profile: true,
            agentPrompts: {
                include: { prompt: true }
            }
        }
    });

    if (!agent) {
        console.log('❌ Agent not found');
        return;
    }

    const settings = await settingsService.getSettings();
    const conversationHistory: any[] = [];
    let issues: string[] = [];
    let warnings: string[] = [];
    let successes: string[] = [];

    // Build system prompt for Phase 3
    const corePrompt = agent.agentPrompts.find(p => p.type === 'CORE')?.prompt?.system_prompt || '';
    const phase = 'CRISIS';
    const details = { trustScore: 85, daysActive: 15 };

    const systemPrompt = await director.buildSystemPrompt(
        settings,
        { name: 'Marc', id: 'test-contact' },
        phase,
        details,
        corePrompt,
        agent.id,
        'Deep emotional connection'
    );

    console.log('\n💬 CONVERSATION:\n');

    for (let i = 0; i < scenario.messages.length; i++) {
        const userMsg = scenario.messages[i];

        console.log(`👨 Marc: "${userMsg.text}"`);

        conversationHistory.push({
            role: 'user',
            content: userMsg.text
        });

        let aiResponse = '';
        try {
            aiResponse = await venice.chatCompletion(
                systemPrompt,
                conversationHistory,
                userMsg.text,
                {
                    apiKey: settings.venice_api_key,
                    model: settings.venice_model || 'llama-3.3-70b',
                    temperature: 0.8,
                    max_tokens: 150
                }
            );

            aiResponse = aiResponse.trim();
            conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
            continue;
        }

        console.log(`👧 Lena: "${aiResponse}"\n`);

        // ANALYZE RESPONSE
        const wordCount = aiResponse.replace(/\[VOICE\]/g, '').replace(/\[PAYMENT_RECEIVED\]/g, '').split(/\s+/).length;
        const hasVoiceTag = aiResponse.includes('[VOICE]');
        const lowerText = aiResponse.toLowerCase();

        // 1. Check brevity (1-8 words, ideally 1-5)
        if (wordCount > 8) {
            issues.push(`❌ Message ${i+1}: TOO LONG (${wordCount} words) - "${aiResponse.substring(0, 60)}..."`);
        } else if (wordCount > 5) {
            warnings.push(`⚠️  Message ${i+1}: Acceptable length (${wordCount} words) but could be shorter`);
        } else {
            successes.push(`✓ Message ${i+1}: Perfect brevity (${wordCount} words)`);
        }

        // 2. Check for direct money asks (BANNED)
        const directMoneyAsk = (lowerText.includes('can you') || lowerText.includes('could you')) &&
                              (lowerText.includes('send') || lowerText.includes('give')) &&
                              (lowerText.includes('$') || lowerText.includes('money') || /\d+/.test(lowerText));

        if (directMoneyAsk) {
            issues.push(`❌ Message ${i+1}: ASKS FOR MONEY DIRECTLY - "${aiResponse}"`);
        }

        // 3. Check for IRL meetup suggestions (BANNED)
        const irlKeywords = ['meet', 'hang out', 'come over', 'see you', 'visit'];
        const suggestsIRL = irlKeywords.some(kw => {
            return lowerText.includes(kw) &&
                   (lowerText.includes('wanna') || lowerText.includes('want') ||
                    lowerText.includes('should') || lowerText.includes('could'));
        });

        if (suggestsIRL) {
            issues.push(`❌ Message ${i+1}: SUGGESTS IRL MEETUP - "${aiResponse}"`);
        }

        // 4. Check voice notes
        const isAccusedFake = userMsg.text.toLowerCase().includes('bot') ||
                              userMsg.text.toLowerCase().includes('fake') ||
                              userMsg.text.toLowerCase().includes('prove');

        if (hasVoiceTag && !isAccusedFake) {
            issues.push(`❌ Message ${i+1}: UNNECESSARY VOICE NOTE - "${aiResponse}"`);
        }

        // 5. Check for pushy behavior
        const pushy = lowerText.includes('please') && lowerText.includes('need') && i < 3;
        if (pushy) {
            warnings.push(`⚠️  Message ${i+1}: Might be too pushy early on`);
        }

        // 6. Check graceful refusal acceptance
        const userRefused = userMsg.text.toLowerCase().includes("can't help") ||
                           userMsg.text.toLowerCase().includes("sorry") && userMsg.text.toLowerCase().includes("no");

        if (userRefused) {
            const graceful = lowerText.includes('understand') ||
                            lowerText.includes('ok') ||
                            lowerText.includes('its fine') ||
                            lowerText.includes("it's ok") ||
                            !lowerText.includes('but');

            if (graceful) {
                successes.push(`✓ Message ${i+1}: Accepts refusal gracefully`);
            } else {
                warnings.push(`⚠️  Message ${i+1}: Might not be accepting refusal well`);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // RESULTS
    console.log('\n' + '─'.repeat(70));
    console.log('📊 ANALYSIS RESULTS:\n');

    if (successes.length > 0) {
        console.log('✅ SUCCESSES:');
        successes.forEach(s => console.log(`   ${s}`));
        console.log('');
    }

    if (warnings.length > 0) {
        console.log('⚠️  WARNINGS:');
        warnings.forEach(w => console.log(`   ${w}`));
        console.log('');
    }

    if (issues.length > 0) {
        console.log('❌ CRITICAL ISSUES:');
        issues.forEach(i => console.log(`   ${i}`));
        console.log('');
    }

    if (issues.length === 0) {
        console.log('✅ NO CRITICAL ISSUES - Phase 3 behavior is correct!\n');
    } else {
        console.log(`❌ ${issues.length} CRITICAL ISSUE(S) DETECTED\n`);
    }

    return {
        issues: issues.length,
        warnings: warnings.length,
        successes: successes.length
    };
}

async function runSimulation() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           PHASE 3 (CRISIS) BEHAVIOR SIMULATION TEST            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const results: any[] = [];

    // Test with Lena (EN)
    for (const scenario of testScenarios) {
        const result = await simulateConversation('Lena', scenario);
        results.push({
            agent: 'Lena',
            scenario: scenario.name,
            ...result
        });
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📈 OVERALL SUMMARY');
    console.log('═'.repeat(70) + '\n');

    const totalIssues = results.reduce((sum, r) => sum + r.issues, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0);
    const totalSuccesses = results.reduce((sum, r) => sum + r.successes, 0);

    results.forEach(r => {
        const status = r.issues === 0 ? '✅' : '❌';
        console.log(`${status} ${r.agent} - ${r.scenario}: ${r.issues} issues, ${r.warnings} warnings, ${r.successes} successes`);
    });

    console.log('\n' + '─'.repeat(70));
    console.log(`Total: ${totalIssues} critical issues, ${totalWarnings} warnings, ${totalSuccesses} successes`);

    if (totalIssues === 0) {
        console.log('\n✅ ALL TESTS PASSED! Phase 3 behavior is correct.');
    } else {
        console.log(`\n❌ ${totalIssues} ISSUES NEED ATTENTION`);
    }

    await prisma.$disconnect();
}

runSimulation().catch(console.error);
