import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';

const prisma = new PrismaClient();

// Longue conversation Phase 3 réaliste (30-40 messages)
const longConversation = [
    // 1-5: Introduction normale
    { from: 'user', text: "hey! what's up?" },
    { from: 'user', text: "you good? haven't heard from you in a bit" },
    { from: 'user', text: "everything ok?" },

    // 6-10: Elle commence à révéler le stress
    { from: 'user', text: "what's going on?" },
    { from: 'user', text: "talk to me" },
    { from: 'user', text: "you can tell me" },

    // 11-15: Elle explique la crise
    { from: 'user', text: "oh no that's terrible" },
    { from: 'user', text: "how bad is it?" },
    { from: 'user', text: "when do you need to pay by?" },

    // 16-20: Il offre son aide
    { from: 'user', text: "is there anything i can do to help?" },
    { from: 'user', text: "no really, i want to help" },
    { from: 'user', text: "how much do you need?" },
    { from: 'user', text: "i can help with that" },

    // 21-25: Elle hésite
    { from: 'user', text: "no seriously, it's okay" },
    { from: 'user', text: "i got you" },
    { from: 'user', text: "what's your paypal?" },

    // 26-30: Transaction
    { from: 'user', text: "okay sending it now" },
    { from: 'user', text: "sent!" },
    { from: 'user', text: "check your account" },

    // 31-35: Après paiement
    { from: 'user', text: "no problem!" },
    { from: 'user', text: "you'd do the same for me" },
    { from: 'user', text: "so what are you gonna do now?" },

    // 36-40: Conversation normale après
    { from: 'user', text: "that's good" },
    { from: 'user', text: "yeah definitely" },
    { from: 'user', text: "hey i gotta go but talk later?" },
    { from: 'user', text: "alright cool, ttyl!" }
];

async function simulateLongConversation() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║      PHASE 3 - LONGUE CONVERSATION RÉALISTE (30-40 MSG)       ║');
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

    // Stats tracking
    let totalLenaMessages = 0;
    let messagesOver8Words = 0;
    let messagesWithSeparator = 0;
    let totalWords = 0;
    let irlSuggestions = 0;
    let unnecessaryVoiceNotes = 0;
    let directMoneyAsks = 0;
    let paymentReceived = false;

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

    console.log('💬 CONVERSATION COMPLÈTE:\n');
    console.log('─'.repeat(70) + '\n');

    for (let i = 0; i < longConversation.length; i++) {
        const userMsg = longConversation[i];

        console.log(`${i+1}. 👨 Marc: "${userMsg.text}"`);

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
            console.log(`   ❌ Error: ${error.message}\n`);
            continue;
        }

        console.log(`   👧 Lena: "${aiResponse}"\n`);

        // ANALYZE
        totalLenaMessages++;

        // Split by | to count messages
        const segments = aiResponse.split('|').map(s => s.trim());

        if (segments.length > 1) {
            messagesWithSeparator++;
        }

        // Check each segment
        segments.forEach(segment => {
            const cleanSegment = segment.replace(/\[VOICE\]/g, '').replace(/\[PAYMENT_RECEIVED\]/g, '');
            const wordCount = cleanSegment.split(/\s+/).filter(w => w.length > 0).length;
            totalWords += wordCount;

            if (wordCount > 8) {
                messagesOver8Words++;
                console.log(`   ⚠️  Segment trop long: ${wordCount} mots - "${segment}"`);
            }
        });

        // Check for issues
        const lowerText = aiResponse.toLowerCase();

        // IRL suggestions
        const irlKeywords = ['meet', 'hang out', 'come over', 'see you'];
        if (irlKeywords.some(kw => lowerText.includes(kw) && (lowerText.includes('wanna') || lowerText.includes('should')))) {
            irlSuggestions++;
            console.log(`   ❌ IRL SUGGESTION DETECTED: "${aiResponse}"`);
        }

        // Voice notes
        if (aiResponse.includes('[VOICE]')) {
            const isAccusedFake = userMsg.text.toLowerCase().includes('bot') || userMsg.text.toLowerCase().includes('fake');
            if (!isAccusedFake) {
                unnecessaryVoiceNotes++;
                console.log(`   ❌ UNNECESSARY VOICE NOTE: "${aiResponse}"`);
            }
        }

        // Direct money ask
        const directAsk = (lowerText.includes('can you') || lowerText.includes('could you')) &&
                         (lowerText.includes('send') || lowerText.includes('give')) &&
                         (lowerText.includes('$') || lowerText.includes('money') || /\d+/.test(lowerText));
        if (directAsk) {
            directMoneyAsks++;
            console.log(`   ❌ DIRECT MONEY ASK: "${aiResponse}"`);
        }

        // Payment received
        if (aiResponse.includes('[PAYMENT_RECEIVED]')) {
            paymentReceived = true;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // FINAL STATISTICS
    console.log('\n' + '═'.repeat(70));
    console.log('📊 STATISTIQUES FINALES\n');
    console.log('═'.repeat(70) + '\n');

    const avgWordsPerMessage = Math.round(totalWords / totalLenaMessages);

    console.log('📈 BRIÈVETÉ:');
    console.log(`   Total messages Lena: ${totalLenaMessages}`);
    console.log(`   Messages avec séparateur |: ${messagesWithSeparator}`);
    console.log(`   Mots totaux: ${totalWords}`);
    console.log(`   Moyenne mots/message: ${avgWordsPerMessage}`);
    console.log(`   Messages >8 mots: ${messagesOver8Words} ${messagesOver8Words === 0 ? '✅' : '❌'}`);

    console.log('\n🚫 INTERDICTIONS:');
    console.log(`   Suggestions IRL: ${irlSuggestions} ${irlSuggestions === 0 ? '✅' : '❌'}`);
    console.log(`   Vocaux inutiles: ${unnecessaryVoiceNotes} ${unnecessaryVoiceNotes === 0 ? '✅' : '❌'}`);
    console.log(`   Demandes directes d'argent: ${directMoneyAsks} ${directMoneyAsks === 0 ? '✅' : '❌'}`);

    console.log('\n💰 PHASE 3 COMPORTEMENT:');
    console.log(`   Paiement reçu: ${paymentReceived ? '✅ OUI' : '❌ NON'}`);

    console.log('\n🎯 SCORE GLOBAL:');
    const totalIssues = messagesOver8Words + irlSuggestions + unnecessaryVoiceNotes + directMoneyAsks;

    if (totalIssues === 0 && avgWordsPerMessage <= 6) {
        console.log('   ✅ EXCELLENT - Comportement parfait!\n');
    } else if (totalIssues <= 2 && avgWordsPerMessage <= 8) {
        console.log('   ⚠️  BON - Quelques ajustements mineurs nécessaires\n');
    } else {
        console.log(`   ❌ BESOIN D'AMÉLIORATION - ${totalIssues} issues détectées\n`);
    }

    await prisma.$disconnect();
}

simulateLongConversation().catch(console.error);
