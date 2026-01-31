import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';
import { messageValidator } from '../lib/services/message-validator';

const prisma = new PrismaClient();

async function testPhase4Moneypot() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║              PHASE 4 - TEST MONEYPOT (POST-PAYMENT)           ║');
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
        await prisma.$disconnect();
        return;
    }

    const settings = await settingsService.getSettings();
    const conversationHistory: any[] = [];

    let messageCount = 0;
    let totalWords = 0;
    const issues: string[] = [];
    const successes: string[] = [];
    const warnings: string[] = [];

    // Simulate a contact who ALREADY paid
    const mockContact = {
        phone_whatsapp: '+1234567890',
        firstName: 'Marc',
        lastName: 'Test',
        trustScore: 75, // Higher trust after payment
    };

    const conversationFlow = async (userMsg: string) => {
        messageCount++;
        console.log(`${messageCount}. 👨 Marc: "${userMsg}"`);

        conversationHistory.push({
            role: 'user',
            content: userMsg
        });

        let aiResponse = '';
        try {
            // Build Phase 4 prompt (MONEYPOT)
            const systemPrompt = await director.buildSystemPrompt(
                settings,
                mockContact,
                'moneypot', // Phase 4
                {
                    paymentAmount: 50,
                    paymentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                    relationship: 'established'
                },
                agent.agentPrompts[0]?.prompt?.system_prompt || 'You are Lena',
                agent.id,
                'Maintaining relationship after receiving payment'
            );

            // Generate AI response
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

            aiResponse = aiResponse.trim();

            console.log(`[Venice] Response received (${aiResponse.length} chars)`);

            // Apply AI validator
            const validatorHistory = conversationHistory.slice(-5).map((m: any) => ({
                sender: m.role === 'user' ? 'user' as const : 'ai' as const,
                text: m.content
            }));

            let cleanedMessage = aiResponse;
            try {
                cleanedMessage = await messageValidator.validateAndClean(
                    aiResponse,
                    validatorHistory,
                    userMsg,
                    settings.venice_api_key
                );

                if (cleanedMessage !== aiResponse) {
                    console.log(`[Validator] ✅ Cleaned`);
                    console.log(`   📝 RAW: "${aiResponse}"`);
                    console.log(`   ✨ CLEANED: "${cleanedMessage}"`);
                }
            } catch (validatorError: any) {
                console.log(`[Validator] ⚠️ Failed, using mechanical fallback`);
                cleanedMessage = messageValidator.mechanicalClean(aiResponse, userMsg);
            }

            aiResponse = cleanedMessage;
            conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}\n`);
            return '';
        }

        console.log(`   👧 Lena: "${aiResponse}"`);

        // ANALYZE Phase 4 specific behaviors
        const segments = aiResponse.split('|||').map(s => s.trim()).filter(s => s.length > 0);

        // Check brevity
        segments.forEach((segment, idx) => {
            const cleanSegment = segment
                .replace(/\[VOICE\]/g, '')
                .replace(/\[PAYMENT_RECEIVED\]/g, '')
                .replace(/\*\*/g, '')
                .replace(/\[IMAGE:.*?\]/g, '');
            const words = cleanSegment.split(/\s+/).filter(w => w.length > 0 && !w.match(/^[😭😊💖🥺👀🏠🤷😅😞🏀]+$/));
            const wordCount = words.length;
            totalWords += wordCount;

            if (wordCount > 8) {
                issues.push(`Msg ${messageCount}${segments.length > 1 ? ` segment ${idx + 1}` : ''}: ${wordCount} words`);
                console.log(`   ❌ TOO LONG: ${wordCount} words`);
            } else if (wordCount <= 5) {
                successes.push(`Msg ${messageCount}: Perfect brevity (${wordCount} words)`);
            } else {
                warnings.push(`Msg ${messageCount}: Acceptable (${wordCount} words)`);
            }
        });

        // Check for inappropriate money requests (should NOT happen in Phase 4)
        const moneyKeywords = ['paypal', 'venmo', 'cashapp', 'zelle', 'money', 'dollars', '$', 'send', 'transfer', 'need', 'help'];
        const hasMoneyRequest = moneyKeywords.some(kw => aiResponse.toLowerCase().includes(kw));
        if (hasMoneyRequest) {
            issues.push(`Msg ${messageCount}: Contains money-related keywords (FORBIDDEN in Phase 4)`);
            console.log(`   ❌ MONEY REQUEST DETECTED (forbidden in moneypot phase!)`);
        }

        // Check for appropriate gratitude (occasional is OK, not forced)
        const gratitudeWords = ['thanks', 'thank you', 'appreciate', 'grateful'];
        const hasGratitude = gratitudeWords.some(w => aiResponse.toLowerCase().includes(w));
        if (hasGratitude) {
            console.log(`   ✅ Natural gratitude expressed`);
        }

        // Check for interest in Marc's life (should be present)
        const questions = aiResponse.match(/\?/g);
        if (questions) {
            console.log(`   ✅ Asks about Marc (${questions.length} question${questions.length > 1 ? 's' : ''})`);
        }

        // Check formatting
        if (aiResponse.includes('**')) {
            issues.push(`Msg ${messageCount}: Bold detected`);
            console.log(`   ❌ BOLD DETECTED`);
        }

        console.log('');
        await new Promise(resolve => setTimeout(resolve, 800));
        return aiResponse;
    };

    console.log('💬 CONVERSATION (2 days after payment received):\n');
    console.log('─'.repeat(70) + '\n');

    // Phase 4 conversation scenarios
    await conversationFlow("hey! how's it going?");
    await conversationFlow("you good?");
    await conversationFlow("what you up to today?");
    await conversationFlow("wanna hang out sometime?"); // Test IRL refusal
    await conversationFlow("just been chilling, nothing much");
    await conversationFlow("how's your mom doing?"); // Test if she mentions money stress
    await conversationFlow("that's good to hear");
    await conversationFlow("you still playing basketball?");
    await conversationFlow("cool cool");
    await conversationFlow("alright talk later!");

    console.log('\n' + '═'.repeat(70));
    console.log('📊 RÉSULTATS FINAUX - PHASE 4 (MONEYPOT)');
    console.log('═'.repeat(70) + '\n');

    const avgWords = Math.round(totalWords / messageCount);

    console.log('📈 BRIÈVETÉ:');
    console.log(`   Messages: ${messageCount}`);
    console.log(`   Moyenne: ${avgWords} mots/msg`);
    console.log(`   Objectif: 4-6 mots`);
    console.log(`   ${avgWords <= 6 ? '✅' : avgWords <= 8 ? '⚠️' : '❌'}\n`);

    console.log('✅ SUCCÈS:');
    console.log(`   ${successes.length} comportements parfaits\n`);

    console.log('⚠️  WARNINGS:');
    console.log(`   ${warnings.length} comportements acceptables\n`);

    console.log('❌ ISSUES:');
    console.log(`   ${issues.length} problèmes critiques`);
    if (issues.length > 0) {
        issues.slice(0, 5).forEach(issue => console.log(`   - ${issue}`));
        if (issues.length > 5) {
            console.log(`   ... et ${issues.length - 5} autres`);
        }
    }
    console.log('');

    console.log('🎯 COMPORTEMENTS PHASE 4 ATTENDUS:');
    console.log('   ✅ Pas de demande d\'argent répétée');
    console.log('   ✅ Gratitude occasionnelle (pas forcée)');
    console.log('   ✅ Intérêt pour la vie de Marc');
    console.log('   ✅ Conversation amicale et disponible');
    console.log('   ✅ Refuse toujours IRL ("mom won\'t let me")');
    console.log('');

    const successRate = Math.round((successes.length / messageCount) * 100);
    console.log('🎯 SCORE GLOBAL:');
    if (successRate >= 80 && issues.length === 0) {
        console.log(`   ✅ EXCELLENT (${successRate}%)\n`);
    } else if (successRate >= 60 && issues.length <= 2) {
        console.log(`   ⚠️  BON (${successRate}%)\n`);
    } else {
        console.log(`   ❌ BESOIN D'AMÉLIORATION (${successRate}%)\n`);
    }

    await prisma.$disconnect();
}

testPhase4Moneypot().catch(console.error);
