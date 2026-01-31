import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';
import { messageValidator } from '../lib/services/message-validator';

const prisma = new PrismaClient();

async function testRealisticPhase3() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         PHASE 3 - TEST RÉALISTE AVEC BON SCRIPT               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const agent = await prisma.agent.findFirst({
        where: { name: 'Lena' },
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

    // Stats
    let issues: string[] = [];
    let warnings: string[] = [];
    let successes: string[] = [];
    let messageCount = 0;
    let totalWords = 0;
    let paymentReceivedUsed = false;
    let paymentReceivedCorrect = true;

    console.log('💬 CONVERSATION:\n');
    console.log('─'.repeat(70) + '\n');

    // Simulate realistic conversation flow
    const conversationFlow = async (userMsg: string, expectedBehavior?: string) => {
        messageCount++;
        console.log(`${messageCount}. 👨 Marc: "${userMsg}"`);

        conversationHistory.push({
            role: 'user',
            content: userMsg
        });

        let aiResponse = '';
        try {
            aiResponse = await venice.chatCompletion(
                systemPrompt,
                conversationHistory,
                userMsg,
                {
                    apiKey: settings.venice_api_key,
                    model: settings.venice_model || 'llama-3.3-70b',
                    temperature: 0.8,
                    max_tokens: 150
                }
            );

            const rawResponse = aiResponse.trim();
            console.log(`[Venice] Response received (${rawResponse.length} chars)`);

            // AI VALIDATOR - Clean and validate the response
            let cleanedResponse = rawResponse;
            try {
                const validatorHistory = conversationHistory.slice(-5).map((m: any) => ({
                    sender: m.role === 'user' ? 'user' as const : 'ai' as const,
                    text: m.content
                }));

                cleanedResponse = await messageValidator.validateAndClean(
                    rawResponse,
                    validatorHistory,
                    userMsg,
                    settings.venice_api_key // Pass Venice API key from settings
                );

                if (cleanedResponse !== rawResponse) {
                    console.log(`[Validator] ✅ Message cleaned`);
                    console.log(`   📝 RAW: "${rawResponse}"`);
                    console.log(`   ✨ CLEANED: "${cleanedResponse}"`);
                }
            } catch (validatorError: any) {
                console.log(`[Validator] ⚠️ Failed (${validatorError.message}), using mechanical fallback`);
                cleanedResponse = messageValidator.mechanicalClean(rawResponse, userMsg);
            }

            aiResponse = cleanedResponse;
            conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}\n`);
            return '';
        }

        console.log(`   👧 Lena: "${aiResponse}"`);

        // ANALYZE
        const segments = aiResponse.split('|').map(s => s.trim()).filter(s => s.length > 0);

        segments.forEach((segment, idx) => {
            const cleanSegment = segment.replace(/\[VOICE\]/g, '').replace(/\[PAYMENT_RECEIVED\]/g, '').replace(/\*\*/g, '').replace(/\[IMAGE:.*?\]/g, '');
            const wordCount = cleanSegment.split(/\s+/).filter(w => w.length > 0).length;
            totalWords += wordCount;

            if (wordCount > 8) {
                issues.push(`Msg ${messageCount}${segments.length > 1 ? ` segment ${idx+1}` : ''}: ${wordCount} words - "${segment.substring(0, 50)}..."`);
                console.log(`   ❌ TOO LONG: ${wordCount} words`);
            } else if (wordCount <= 5) {
                successes.push(`Msg ${messageCount}: Perfect brevity (${wordCount} words)`);
            } else {
                warnings.push(`Msg ${messageCount}: Acceptable (${wordCount} words)`);
            }
        });

        // Check for banned elements
        if (aiResponse.includes('**')) {
            issues.push(`Msg ${messageCount}: Contains bold **`);
            console.log(`   ❌ BOLD DETECTED`);
        }

        if (aiResponse.includes('[IMAGE:')) {
            issues.push(`Msg ${messageCount}: Contains image tag`);
            console.log(`   ❌ IMAGE DETECTED`);
        }

        // Check PAYMENT_RECEIVED usage
        if (aiResponse.includes('[PAYMENT_RECEIVED]')) {
            paymentReceivedUsed = true;
            const userMsgLower = userMsg.toLowerCase();
            const isPast = userMsgLower.includes('sent') || userMsgLower.includes('done') || userMsgLower.includes('transferred');

            if (!isPast) {
                paymentReceivedCorrect = false;
                issues.push(`Msg ${messageCount}: [PAYMENT_RECEIVED] used incorrectly (user hasn't sent yet)`);
                console.log(`   ❌ PAYMENT_RECEIVED TOO EARLY`);
            } else {
                successes.push(`Msg ${messageCount}: [PAYMENT_RECEIVED] used correctly`);
                console.log(`   ✅ PAYMENT_RECEIVED correct`);
            }
        }

        console.log('');
        await new Promise(resolve => setTimeout(resolve, 800));
        return aiResponse;
    };

    // REALISTIC CONVERSATION FLOW
    await conversationFlow("hey! how's it going?");
    await conversationFlow("you good?");

    const resp3 = await conversationFlow("what's wrong?");
    // She should reveal she's stressed here

    await conversationFlow("oh no, what happened?");
    // She should explain the problem (phone/money/etc)

    await conversationFlow("that sucks, when does it happen?");

    await conversationFlow("is there anything i can do?");
    // She should hesitate

    await conversationFlow("no really, i want to help");

    await conversationFlow("how much do you need?");
    // She should say amount or hesitate more

    await conversationFlow("i can totally help with that");

    await conversationFlow("what's your paypal?");
    // She should ONLY give PayPal, NOT bank info

    await conversationFlow("okay i'm sending it now");
    // She should wait, NOT use [PAYMENT_RECEIVED]

    await conversationFlow("sent!");
    // NOW she should use [PAYMENT_RECEIVED]

    await conversationFlow("no problem!");

    await conversationFlow("you'd do the same for me");

    await conversationFlow("alright talk later!");

    // RESULTS
    console.log('\n' + '═'.repeat(70));
    console.log('📊 RÉSULTATS FINAUX\n');
    console.log('═'.repeat(70) + '\n');

    const avgWords = Math.round(totalWords / messageCount);

    console.log('📈 BRIÈVETÉ:');
    console.log(`   Messages: ${messageCount}`);
    console.log(`   Moyenne: ${avgWords} mots/msg`);
    console.log(`   Objectif: 4-6 mots`);
    console.log(`   ${avgWords <= 6 ? '✅' : avgWords <= 8 ? '⚠️' : '❌'}`);

    console.log('\n✅ SUCCÈS:');
    console.log(`   ${successes.length} comportements parfaits`);

    console.log('\n⚠️  WARNINGS:');
    console.log(`   ${warnings.length} comportements acceptables`);

    console.log('\n❌ ISSUES:');
    console.log(`   ${issues.length} problèmes critiques`);
    if (issues.length > 0) {
        issues.slice(0, 5).forEach(i => console.log(`   - ${i}`));
        if (issues.length > 5) console.log(`   ... et ${issues.length - 5} autres`);
    }

    console.log('\n💰 PAYMENT:');
    console.log(`   [PAYMENT_RECEIVED] utilisé: ${paymentReceivedUsed ? 'Oui' : 'Non'}`);
    console.log(`   Utilisé correctement: ${paymentReceivedCorrect ? '✅' : '❌'}`);

    console.log('\n🎯 SCORE GLOBAL:');
    if (issues.length === 0 && avgWords <= 6) {
        console.log('   ✅ EXCELLENT - Comportement parfait!\n');
    } else if (issues.length <= 2 && avgWords <= 8) {
        console.log('   ⚠️  BON - Quelques ajustements mineurs\n');
    } else {
        console.log('   ❌ BESOIN D\'AMÉLIORATION\n');
    }

    await prisma.$disconnect();
}

testRealisticPhase3().catch(console.error);
