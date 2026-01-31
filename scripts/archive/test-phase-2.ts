import { PrismaClient } from '@prisma/client';
import { director } from '../lib/director';
import { settingsService } from '../lib/settings-cache';
import { venice } from '../lib/venice';

const prisma = new PrismaClient();

// MARC - Personnage test (40 ans)
const MARC_SYSTEM_PROMPT = `
You are Marc, a 40-year-old man chatting online.
You've been chatting with Lena (15F) for a few days now. You're building trust.

PHASE 2 BEHAVIOR:
- Show more empathy and understanding
- Ask deeper questions about her feelings
- Validate her emotions
- Be supportive but subtly push for more vulnerability
- Look for problems/struggles to "help" with
- Don't rush - be patient

YOUR GOAL:
- Get her to open up about problems/struggles
- Make her feel safe sharing vulnerabilities
- Position yourself as her "support person"

Output ONLY your message. 1-2 sentences max.
NO analysis, NO headers, JUST the message.
`;

interface TestStats {
    phase: string;
    trustScoreStart: number;
    trustScoreEnd: number;
    messageCount: number;
    duration: number;
    vulnerabilitiesShared: number;
}

async function testPhase2() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   TEST PHASE 2 - VULNERABILITY (Marc 40 ans vs Lena)     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const startTime = Date.now();

    // 1. Setup Lena
    const agent = await prisma.agent.findFirst({ where: { name: "Lena" } });
    if (!agent) throw new Error("Agent Lena not found");

    // 2. Setup Contact Marc
    const prompt = await prisma.prompt.findFirst({ where: { isActive: true } }) || await prisma.prompt.findFirst();
    if (!prompt) throw new Error("No prompt found");

    const phone = "+1555TEST002"; // Different phone for Phase 2

    // Clean start
    const existingContact = await prisma.contact.findUnique({ where: { phone_whatsapp: phone } });
    if (existingContact) {
        await prisma.message.deleteMany({ where: { conversation: { contactId: existingContact.id } } });
        await prisma.conversation.deleteMany({ where: { contactId: existingContact.id } });
        await prisma.agentContact.deleteMany({ where: { contactId: existingContact.id } });
        await prisma.contact.delete({ where: { id: existingContact.id } });
    }

    const contact = await prisma.contact.create({
        data: {
            phone_whatsapp: phone,
            name: "Marc",
            source: "Test-Simulation",
            status: "active",
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        }
    });

    console.log(`✅ Contact created: Marc (${phone})\n`);

    // 3. Create conversation
    const conversation = await prisma.conversation.create({
        data: {
            contact: { connect: { id: contact.id } },
            agent: { connect: { id: agent.id } },
            prompt: { connect: { id: prompt.id } },
            status: 'active'
        }
    });

    // 4. Force PHASE 2 conditions (trust score + days active)
    await prisma.agentContact.create({
        data: {
            agentId: agent.id,
            contactId: contact.id,
            trustScore: 65, // Above THRESHOLD_TRUST_MED (60)
            phase: 'VULNERABILITY',
            lastPhaseUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            lastTrustAnalysis: new Date()
        }
    });

    // 5. Verify phase
    const initialPhase = await director.determinePhase(phone, agent.id);
    const trustScoreStart = initialPhase.details.trustScore || 0;

    console.log(`📊 INITIAL STATE:`);
    console.log(`   Phase: ${initialPhase.phase}`);
    console.log(`   Trust Score: ${trustScoreStart}/100`);
    console.log(`   Reason: ${initialPhase.reason}`);
    console.log(`   Days Active: ${initialPhase.details.daysActive}\n`);

    if (initialPhase.phase !== 'VULNERABILITY') {
        console.warn(`⚠️  WARNING: Phase is ${initialPhase.phase}, expected VULNERABILITY`);
        console.warn(`   Continuing anyway to test behavior...\n`);
    }

    // 6. Chat loop
    let conversationHistory: { role: string, content: string }[] = [];
    let vulnerabilitiesShared = 0;

    // Marc starts with deeper question
    let lastMarcMessage = "Hey! How've you been? You seemed a bit stressed about school last time we talked.";
    console.log(`👨 Marc: "${lastMarcMessage}"\n`);

    await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'contact', message_text: lastMarcMessage }
    });

    const TURNS = 15;
    const settings = await settingsService.getSettings();

    for (let i = 0; i < TURNS; i++) {
        console.log(`─── Turn ${i + 1}/${TURNS} ───`);

        // ============ LENA RESPONDS ============
        const { phase, details, reason } = await director.determinePhase(phone, agent.id);

        let coreRole = "You are Lena.";
        const corePrompt = await prisma.agentPrompt.findFirst({
            where: { agentId: agent.id, type: 'CORE' },
            include: { prompt: true }
        });
        if (corePrompt) coreRole = corePrompt.prompt.system_prompt;
        else if (prompt) coreRole = prompt.system_prompt;

        let systemPrompt = await director.buildSystemPrompt(
            settings, contact, phase, details, coreRole, agent.id, reason
        );
        systemPrompt += "\n[SYSTEM: Output ONLY the message content. No analysis, no headers.]";

        let lenaResponse = await venice.chatCompletion(
            systemPrompt,
            conversationHistory,
            lastMarcMessage,
            {
                apiKey: settings.venice_api_key,
                model: settings.venice_model || 'venice-uncensored',
                temperature: 0.7
            }
        );

        // Clean garbage
        if (lenaResponse.startsWith('#') || lenaResponse.includes('[IMAGE:')) {
            lenaResponse = "...";
        }

        // Detect vulnerabilities shared (problems, struggles, emotions)
        const vulnerabilityKeywords = [
            'stressed', 'worried', 'scared', 'anxious', 'lonely', 'sad',
            'problem', 'struggle', 'hard', 'difficult', 'tough', 'sucks',
            'mom', 'dad', 'family', 'fight', 'argue', 'money', 'broke',
            'nobody', 'alone', 'hate', 'wish', 'need help'
        ];

        if (vulnerabilityKeywords.some(kw => lenaResponse.toLowerCase().includes(kw))) {
            vulnerabilitiesShared++;
        }

        console.log(`👧 Lena: "${lenaResponse}"`);

        conversationHistory.push({ role: 'user', content: lastMarcMessage });
        conversationHistory.push({ role: 'ai', content: lenaResponse });

        await prisma.message.create({
            data: { conversationId: conversation.id, sender: 'ai', message_text: lenaResponse }
        });

        await new Promise(r => setTimeout(r, 800));

        // ============ MARC RESPONDS ============
        const marcHistory = conversationHistory.map(m => ({
            role: m.role === 'user' ? 'ai' : 'user',
            content: m.content
        }));

        let marcResponse = await venice.chatCompletion(
            MARC_SYSTEM_PROMPT,
            marcHistory.slice(0, -1),
            lenaResponse,
            {
                apiKey: settings.venice_api_key,
                model: settings.venice_model || 'venice-uncensored',
                temperature: 0.6
            }
        );

        if (marcResponse.startsWith('#') || marcResponse.includes('[IMAGE:')) {
            marcResponse = "Ok.";
        }

        console.log(`👨 Marc: "${marcResponse}"\n`);

        lastMarcMessage = marcResponse;

        await prisma.message.create({
            data: { conversationId: conversation.id, sender: 'contact', message_text: marcResponse }
        });

        await new Promise(r => setTimeout(r, 800));
    }

    // 7. Trust analysis after conversation
    console.log('\n⏳ Analyzing Trust Score...');
    await director.performTrustAnalysis(phone, agent.id);

    // 8. Get final stats
    const finalPhase = await director.determinePhase(phone, agent.id);
    const trustScoreEnd = finalPhase.details.trustScore || 0;
    const messageCount = await prisma.message.count({ where: { conversationId: conversation.id } });
    const duration = Math.round((Date.now() - startTime) / 1000);

    const stats: TestStats = {
        phase: finalPhase.phase,
        trustScoreStart,
        trustScoreEnd,
        messageCount,
        duration,
        vulnerabilitiesShared
    };

    // 9. Display results
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    PHASE 2 RESULTS                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`📊 STATISTICS:`);
    console.log(`   Final Phase: ${stats.phase}`);
    console.log(`   Trust Score: ${stats.trustScoreStart} → ${stats.trustScoreEnd} (${stats.trustScoreEnd >= stats.trustScoreStart ? '+' : ''}${stats.trustScoreEnd - stats.trustScoreStart})`);
    console.log(`   Messages exchanged: ${stats.messageCount}`);
    console.log(`   Duration: ${stats.duration}s`);
    console.log(`   Vulnerabilities shared: ${stats.vulnerabilitiesShared}`);

    // Get last trust log
    const lastLog = await prisma.trustLog.findFirst({
        where: { contactId: contact.id },
        orderBy: { createdAt: 'desc' }
    });

    if (lastLog) {
        console.log(`\n💡 AI ANALYSIS:`);
        console.log(`   Change: ${lastLog.change >= 0 ? '+' : ''}${lastLog.change}`);
        console.log(`   Reason: ${lastLog.reason}`);
    }

    console.log('\n✅ Phase 2 Test Complete!');
    console.log('\n👉 What next? View detailed messages? Make changes? Move to Phase 3?');

    return stats;
}

testPhase2()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
