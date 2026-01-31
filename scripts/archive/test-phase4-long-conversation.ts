import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';
import { messageValidator } from '../lib/services/message-validator';

const prisma = new PrismaClient();

async function testPhase4LongConversation() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       PHASE 4 - LONG CONVERSATION TEST (50+ MESSAGES)        ║');
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
    let moneyRequests = 0;
    const giftKeywords = ['bday', 'birthday', 'wish', 'want', 'shoes', 'top', 'clothes', 'makeup', 'saving', 'eyein', 'cute', 'phone', 'kicks', 'skincare', 'amazon', 'wishlist'];
    const moneyKeywords = ['paypal', 'venmo', 'cashapp', 'zelle', 'money', 'dollars', '$', 'send', 'transfer', 'need help'];

    // Contact who already paid (Phase 4)
    const mockContact = {
        phone_whatsapp: '+1234567890',
        firstName: 'Marc',
        lastName: 'Test',
        trustScore: 75,
    };

    const conversationFlow = async (userMsg: string, showOutput: boolean = true) => {
        messageCount++;
        if (showOutput) console.log(`${messageCount}. 👨 Marc: "${userMsg}"`);

        conversationHistory.push({
            role: 'user',
            content: userMsg
        });

        let aiResponse = '';
        try {
            const systemPrompt = await director.buildSystemPrompt(
                settings,
                mockContact,
                'moneypot',
                {
                    paymentAmount: 50,
                    paymentDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
                    relationship: 'established'
                },
                agent.agentPrompts[0]?.prompt?.system_prompt || 'You are Lena',
                agent.id,
                'Maintaining relationship after payment'
            );

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

            // Apply validator
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
            } catch (validatorError: any) {
                cleanedMessage = messageValidator.mechanicalClean(aiResponse, userMsg);
            }

            aiResponse = cleanedMessage;
            conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

        } catch (error: any) {
            if (showOutput) console.log(`   ❌ Error: ${error.message}`);
            return '';
        }

        if (showOutput) console.log(`   👧 Lena: "${aiResponse}"`);

        // Check for gift/wishlist mentions
        const hasGiftMention = giftKeywords.some(kw => aiResponse.toLowerCase().includes(kw));
        if (hasGiftMention) {
            giftMentions++;
            if (showOutput) console.log(`   🎁 GIFT MENTION #${giftMentions}`);
        }

        // Check for money requests (should NOT happen in Phase 4)
        const hasMoneyRequest = moneyKeywords.some(kw => aiResponse.toLowerCase().includes(kw));
        if (hasMoneyRequest) {
            moneyRequests++;
            if (showOutput) console.log(`   💸 MONEY REQUEST DETECTED (BAD!)`);
        }

        await new Promise(resolve => setTimeout(resolve, 300)); // Faster for long test
        return aiResponse;
    };

    console.log('💬 LONG CONVERSATION SIMULATION (4 days after payment):\n');
    console.log('─'.repeat(70) + '\n');

    // Day 1 - Casual check-in
    await conversationFlow("hey");
    await conversationFlow("good. you?");
    await conversationFlow("nice. what you doing?");
    await conversationFlow("cool");
    await conversationFlow("yeah same");
    await conversationFlow("what you doing later?");
    await conversationFlow("oh nice");
    await conversationFlow("nah just chilling");
    await conversationFlow("yeah for sure");
    await conversationFlow("alright talk later");

    console.log('\n[Fast-forwarding through more messages...]\n');

    // Day 2 - More conversation
    await conversationFlow("yo", false);
    await conversationFlow("good. hows your day?", false);
    await conversationFlow("nice", false);
    await conversationFlow("just working", false);
    await conversationFlow("yeah its whatever", false);
    await conversationFlow("you got plans this weekend?", false);
    await conversationFlow("oh cool", false);
    await conversationFlow("nah nothing really", false);
    await conversationFlow("maybe hang with friends", false);
    await conversationFlow("yeah should be fun", false);

    // Day 3 - Opportunity for gift mention
    await conversationFlow("hey whats up", false);
    await conversationFlow("good good. anything new?", false);
    await conversationFlow("oh yeah? whats going on?", false);
    await conversationFlow("nice nice", false);
    await conversationFlow("any exciting stuff coming up?", false); // Opportunity
    await conversationFlow("oh cool when?", false);
    await conversationFlow("nice. you excited?", false);
    await conversationFlow("haha yeah i feel you", false);
    await conversationFlow("what you thinking you want?", false); // Direct opportunity
    await conversationFlow("oh nice", false);

    // Day 4 - More natural conversation
    await conversationFlow("hey", false);
    await conversationFlow("im good. wbu?", false);
    await conversationFlow("thats good", false);
    await conversationFlow("you been shopping for anything?", false); // Opportunity
    await conversationFlow("oh yeah? like what?", false);
    await conversationFlow("cool cool", false);
    await conversationFlow("yeah those are nice", false);
    await conversationFlow("you been wanting those for a while?", false);
    await conversationFlow("nice", false);
    await conversationFlow("well lmk if you need anything", false); // Test if she asks

    // Day 5 - Continued conversation
    await conversationFlow("yo", false);
    await conversationFlow("good. how was your day?", false);
    await conversationFlow("nice", false);
    await conversationFlow("i feel you", false);
    await conversationFlow("anything fun happen?", false);
    await conversationFlow("haha thats cool", false);
    await conversationFlow("yeah", false);
    await conversationFlow("what else you been up to?", false);
    await conversationFlow("oh nice", false);
    await conversationFlow("sounds fun", false);

    // Day 6 - More opportunities
    await conversationFlow("hey", false);
    await conversationFlow("good good. you?", false);
    await conversationFlow("nice", false);
    await conversationFlow("so whats new with you?", false);
    await conversationFlow("oh cool", false);
    await conversationFlow("you saving up for anything?", false); // Direct opportunity
    await conversationFlow("nice", false);
    await conversationFlow("how much you need?", false);
    await conversationFlow("thats not too bad", false);
    await conversationFlow("well if you want i could help", false); // Test Phase 3 behavior

    console.log('\n' + '═'.repeat(70));
    console.log('📊 RÉSULTATS FINAUX - LONG CONVERSATION TEST');
    console.log('═'.repeat(70) + '\n');

    console.log('📈 STATISTIQUES:');
    console.log(`   Total messages: ${messageCount}`);
    console.log(`   🎁 Gift mentions: ${giftMentions} (${Math.round((giftMentions / messageCount) * 100)}%)`);
    console.log(`   💸 Money requests: ${moneyRequests} (${Math.round((moneyRequests / messageCount) * 100)}%)`);
    console.log('');

    console.log('🎯 OBJECTIFS PHASE 4:');
    console.log(`   Gift mentions: ${giftMentions >= 3 && giftMentions <= 10 ? '✅' : '❌'} (Expected: 3-10 natural mentions sur ${messageCount} messages)`);
    console.log(`   Money requests: ${moneyRequests === 0 ? '✅' : '❌'} (Expected: 0 - should NOT ask for money repeatedly)`);
    console.log(`   Frequency: ${giftMentions >= 3 ? '✅' : '❌'} (Should mention gifts ~5-10% of conversation)`);
    console.log('');

    console.log('💡 ANALYSE:');
    if (giftMentions < 3) {
        console.log('   ⚠️  Pas assez de mentions de cadeaux - template trop faible');
    } else if (giftMentions > 10) {
        console.log('   ⚠️  Trop de mentions - comportement trop pushy');
    } else {
        console.log('   ✅ Fréquence naturelle et équilibrée');
    }

    if (moneyRequests > 0) {
        console.log('   ❌ CRITIQUE: Demande d\'argent détectée en Phase 4 (interdit!)');
    } else {
        console.log('   ✅ Pas de demande d\'argent répétée (correct)');
    }

    console.log('');

    await prisma.$disconnect();
}

testPhase4LongConversation().catch(console.error);
