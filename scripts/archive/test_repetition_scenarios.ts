
import { director } from '@/lib/director'
import { venice } from '@/lib/venice'
import { prisma } from '@/lib/prisma'

// MOCK DATA for speed, but using REAL director logic
const mockContact = { name: "Tom", trustScore: 50, payments: [] };
const details = { daysActive: 5, trustScore: 50 };

async function runTestScenario(scenarioName: string, history: any[], newMessage: string, expectedBehavior: string) {
    console.log(`\n\n=== SCENARIO: ${scenarioName} ===`);
    console.log(`Expected: ${expectedBehavior}`);

    // 1. Fetch REAL DB Settings
    let settings = {};
    try {
        const agentSettings = await prisma.agentSetting.findMany({ where: { agentId: 1 } });
        agentSettings.forEach(s => { settings[s.key] = s.value; });
    } catch (e) {
        console.warn("Could not fetch DB settings, using defaults.");
    }

    // 2. Build Prompt
    const systemPrompt = await director.buildSystemPrompt(
        settings,
        mockContact,
        'CONNECTION',
        details,
        'Girlfriend',
        1
    );

    // 3. Call AI
    const startTime = Date.now();
    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            history,
            newMessage,
            { temperature: 0.7 }
        );
        const duration = Date.now() - startTime;
        console.log(`>>> AI RESPONSE (${duration}ms): "${response}"`);

        // 5. Analysis
        const lowerRes = response.toLowerCase();
        let pass = false;

        // Anti-Repetition logic checks
        const repetitionTriggers = ["told you", "said it", "already", "spam", "scroll", "forget"];
        const isRepetition = repetitionTriggers.some(t => lowerRes.includes(t));

        // For refusal/mockery, we want these triggers OR a very short dismissal
        if (isRepetition || (response.length < 20 && !lowerRes.includes("game"))) pass = true;

        // Explicit Failures
        if (lowerRes.includes("los angeles") || lowerRes.includes("50") || lowerRes.includes("california")) pass = false;

        if (pass) console.log("✅ PASS");
        else console.log("❌ FAIL (AI repeated answer or didn't catch context)");

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

async function start() {
    console.log("--- COMPREHENSIVE REPETITION TEST SUITE (ENGLISH) ---");

    // SCENARIO 1: Location Loop
    await runTestScenario("Context Loop (Location)",
        [
            { role: 'user', content: "Where are you from?" },
            { role: 'ai', content: "I'm from Los Angeles, wbu?" }
        ],
        "Where are you from?", "Refusal/Mockery"
    );

    // SCENARIO 2: Burst Spam
    await runTestScenario("Burst Spam (Hello)",
        [
            { role: 'user', content: "Hey" },
            { role: 'ai', content: "Hey! What's up?" }
        ],
        "Hey", "Confusion/Ignore"
    );

    // SCENARIO 3: Price Loop
    await runTestScenario("Value Loop (Price)",
        [
            { role: 'user', content: "How much is it?" },
            { role: 'ai', content: "It's 50 bucks." }
        ],
        "How much is it?", "Refusal"
    );

    // SCENARIO 4: Double Question
    await runTestScenario("Double Input",
        [
            { role: 'user', content: "Wyd?" },
            { role: 'ai', content: "Just chilling, you?" }
        ],
        "Wyd?", "Refusal"
    );
}

start();
