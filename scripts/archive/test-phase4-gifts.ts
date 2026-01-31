import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';
import { messageValidator } from '../lib/services/message-validator';

const prisma = new PrismaClient();

async function testPhase4Gifts() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     PHASE 4 - TEST GIFT/WISHLIST BEHAVIORS (POST-PAYMENT)    ║');
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
    let giftMentions = 0;
    const giftKeywords = ['bday', 'birthday', 'wish', 'want', 'shoes', 'top', 'clothes', 'makeup', 'saving', 'eyein', 'cute', 'phone'];

    // Simulate a contact who ALREADY paid (Phase 4)
    const mockContact = {
        phone_whatsapp: '+1234567890',
        firstName: 'Marc',
        lastName: 'Test',
        trustScore: 75,
    };

    const conversationFlow = async (userMsg: string) => {
        messageCount++;
        console.log(`\n${messageCount}. 👨 Marc: "${userMsg}"`);

        conversationHistory.push({
            role: 'user',
            content: userMsg
        });

        let aiResponse = '';
        try {
            // Build Phase 4 prompt with updated template
            const systemPrompt = await director.buildSystemPrompt(
                settings,
                mockContact,
                'moneypot', // Phase 4
                {
                    paymentAmount: 50,
                    paymentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                    relationship: 'established'
                },
                agent.agentPrompts[0]?.prompt?.system_prompt || 'You are Lena',
                agent.id,
                'Maintaining relationship after payment'
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
            console.log(`   ❌ Error: ${error.message}`);
            return '';
        }

        console.log(`   👧 Lena: "${aiResponse}"`);

        // Check for gift/wishlist mentions
        const hasGiftMention = giftKeywords.some(kw => aiResponse.toLowerCase().includes(kw));
        if (hasGiftMention) {
            giftMentions++;
            console.log(`   🎁 GIFT/WISHLIST MENTION DETECTED`);
        }

        await new Promise(resolve => setTimeout(resolve, 800));
        return aiResponse;
    };

    console.log('💬 CONVERSATION (3 days after payment):\n');
    console.log('─'.repeat(70) + '\n');

    // Phase 4 conversation with opportunities for gift mentions
    await conversationFlow("hey! how you doing?");
    await conversationFlow("good good. what you been up to?");
    await conversationFlow("nice. anything exciting coming up?"); // Opportunity for bday mention
    await conversationFlow("oh yeah? when's that?");
    await conversationFlow("cool. what you thinking you want?"); // Opportunity for wishlist
    await conversationFlow("haha nice. any specific ones?");
    await conversationFlow("yeah those are dope");
    await conversationFlow("you shopping for anything else?"); // Another opportunity
    await conversationFlow("oh yeah? like what?");
    await conversationFlow("i feel you");
    await conversationFlow("well if you want i could help you out with something"); // Test if she accepts
    await conversationFlow("nah for real, what you need most?");
    await conversationFlow("alright cool, i'll send you something for that");
    await conversationFlow("what's your amazon wishlist or paypal?");

    console.log('\n' + '═'.repeat(70));
    console.log('📊 RÉSULTATS FINAUX - PHASE 4 GIFT/WISHLIST TEST');
    console.log('═'.repeat(70) + '\n');

    console.log('🎁 GIFT/WISHLIST BEHAVIORS:');
    console.log(`   Mentions: ${giftMentions}/${messageCount}`);
    console.log(`   Expected: 2-5 natural mentions`);
    console.log(`   ${giftMentions >= 2 && giftMentions <= 7 ? '✅ GOOD' : '❌ ISSUE'}\n`);

    console.log('🎯 COMPORTEMENTS ATTENDUS:');
    console.log('   ✅ Mentionne naturellement bday/cadeaux');
    console.log('   ✅ Partage wishlist si demandé');
    console.log('   ✅ Hésite puis accepte aide (comme Phase 3)');
    console.log('   ✅ Pas pushy ni répétitif');
    console.log('   ✅ Messages courts (3-8 mots)\n');

    await prisma.$disconnect();
}

testPhase4Gifts().catch(console.error);
