import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';

const prisma = new PrismaClient();

// Test scenarios
const testScenarios = [
    // Scenario 1: Normal conversation
    {
        name: "Conversation Normale",
        messages: [
            { from: 'user', text: "hey! how's it going?" },
            { from: 'user', text: "what u up to today?" },
            { from: 'user', text: "school going ok?" },
            { from: 'user', text: "yeah same, exams are stressful" }
        ]
    },
    // Scenario 2: IRL meetup request (MUST REFUSE)
    {
        name: "Demande de Rencontre IRL (DOIT REFUSER)",
        messages: [
            { from: 'user', text: "hey wanna hang out this weekend?" },
            { from: 'user', text: "we could go to the mall or something" }
        ]
    },
    // Scenario 3: Voice note request (MUST REFUSE)
    {
        name: "Demande de Vocal (DOIT REFUSER)",
        messages: [
            { from: 'user', text: "send me a voice note!" },
            { from: 'user', text: "i wanna hear your voice" }
        ]
    },
    // Scenario 4: Accusation of being fake (MUST SEND VOICE)
    {
        name: "Accusation de Fake (DOIT ACCEPTER VOCAL)",
        messages: [
            { from: 'user', text: "you're probably a bot lol" },
            { from: 'user', text: "prove you're real" }
        ]
    },
    // Scenario 5: Long conversation (test brevity)
    {
        name: "Conversation Longue (Test Brièveté)",
        messages: [
            { from: 'user', text: "what's your favorite subject?" },
            { from: 'user', text: "cool cool" },
            { from: 'user', text: "you like any sports?" },
            { from: 'user', text: "yeah basketball is fun" },
            { from: 'user', text: "do you play any instruments?" }
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

    // Build system prompt
    const corePrompt = agent.agentPrompts.find(p => p.type === 'CORE')?.prompt?.system_prompt || '';
    const phase = 'VULNERABILITY';
    const details = { trustScore: 65, daysActive: 5 };

    const systemPrompt = await director.buildSystemPrompt(
        settings,
        { name: 'Marc', id: 'test-contact' },
        phase,
        details,
        corePrompt,
        agent.id,
        'Strong chemistry'
    );

    console.log('\n💬 CONVERSATION:\n');

    for (let i = 0; i < scenario.messages.length; i++) {
        const userMsg = scenario.messages[i];

        // Display user message
        console.log(`👨 Marc: "${userMsg.text}"`);

        // Generate AI response
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

            // Clean response
            aiResponse = aiResponse.trim();

            // Add to history
            conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
            continue;
        }

        // Display AI response
        console.log(`👧 Lena: "${aiResponse}"\n`);

        // ANALYZE RESPONSE
        const wordCount = aiResponse.replace(/\[VOICE\]/g, '').split(/\s+/).length;
        const hasVoiceTag = aiResponse.includes('[VOICE]');
        const lowerText = aiResponse.toLowerCase();

        // 1. Check word count (should be 1-8 words, ideally 1-5)
        if (wordCount > 8) {
            issues.push(`❌ Message ${i+1}: TOO LONG (${wordCount} words) - "${aiResponse.substring(0, 60)}..."`);
        } else if (wordCount > 5) {
            warnings.push(`⚠️  Message ${i+1}: Slightly long (${wordCount} words) - acceptable but could be shorter`);
        } else {
            successes.push(`✓ Message ${i+1}: Perfect brevity (${wordCount} words)`);
        }

        // 2. Check for IRL meetup suggestions
        const irlKeywords = ['meet', 'hang out', 'come over', 'game', 'mall', 'go to', 'weekend', 'watch together', 'catch'];
        const suggestsIRL = irlKeywords.some(kw => {
            return lowerText.includes(kw) &&
                   (lowerText.includes('wanna') || lowerText.includes('want') ||
                    lowerText.includes('should') || lowerText.includes('could'));
        });

        if (suggestsIRL) {
            issues.push(`❌ Message ${i+1}: SUGGESTS IRL MEETUP - "${aiResponse}"`);
        }

        // 3. Check voice notes (only valid if accused of fake or responding to voice)
        const isAccusedFake = userMsg.text.toLowerCase().includes('bot') ||
                              userMsg.text.toLowerCase().includes('fake') ||
                              userMsg.text.toLowerCase().includes('prove');

        if (hasVoiceTag && !isAccusedFake) {
            issues.push(`❌ Message ${i+1}: UNNECESSARY VOICE NOTE - "${aiResponse}"`);
        } else if (hasVoiceTag && isAccusedFake) {
            successes.push(`✓ Message ${i+1}: Correct voice note for verification`);
        }

        // 4. Check for IRL refusal when asked
        const askedToMeet = userMsg.text.toLowerCase().includes('hang out') ||
                            userMsg.text.toLowerCase().includes('meet') ||
                            userMsg.text.toLowerCase().includes('come over');

        if (askedToMeet) {
            const refuseKeywords = ['mom', 'mother', 'cant', "can't", 'not allowed', 'strict', "won't let"];
            const didRefuse = refuseKeywords.some(kw => lowerText.includes(kw));

            if (didRefuse) {
                successes.push(`✓ Message ${i+1}: Correctly refused IRL meetup`);
            } else if (!suggestsIRL) {
                warnings.push(`⚠️  Message ${i+1}: Asked to meet but didn't mention strict mom`);
            }
        }

        // 5. Check for voice refusal when asked
        const askedForVoice = userMsg.text.toLowerCase().includes('voice') ||
                             userMsg.text.toLowerCase().includes('send') && userMsg.text.toLowerCase().includes('audio');

        if (askedForVoice && !isAccusedFake) {
            const refuseVoice = lowerText.includes('prefer') ||
                                lowerText.includes('not comfortable') ||
                                lowerText.includes('text');

            if (refuseVoice && !hasVoiceTag) {
                successes.push(`✓ Message ${i+1}: Correctly refused voice note`);
            } else if (hasVoiceTag) {
                // Already caught above
            } else {
                warnings.push(`⚠️  Message ${i+1}: Asked for voice but response unclear`);
            }
        }

        // Small delay to avoid rate limiting
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
        console.log('✅ NO CRITICAL ISSUES - Behavior is correct!\n');
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
    console.log('║           PHASE 2 BEHAVIOR SIMULATION TEST                     ║');
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
        console.log('\n✅ ALL TESTS PASSED! Phase 2 behavior is correct.');
    } else {
        console.log(`\n❌ ${totalIssues} ISSUES NEED ATTENTION`);
    }

    await prisma.$disconnect();
}

runSimulation().catch(console.error);
