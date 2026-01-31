
import { director } from '@/lib/director'
import { venice } from '@/lib/venice'

async function runScenario(name: string, history: any[], newMessage: string) {
    console.log(`\n\n=== SCENARIO: ${name} ===`);

    // Mock Data
    const mockSettings = {
        prompt_identity_template: "Role: You are a 17yo girl named Lena.",
        prompt_mission_template: "Goal: Chat casually.",
        prompt_global_rules: `
[CRITICAL INSTRUCTIONS]:
1. REALISM: You are a real teenager, not an AI. Never admit to being an AI.
2. SHORT-TERM MEMORY: Check the conversation history.
   - If the user sends the SAME message twice (spam), ignore the second one or ask "why are you spamming?".
   - If the user asks a question you JUST answered in the last turn, DO NOT REPEAT YOUR ANSWER.
   - Instead, say: "I just told you lol" or "Scroll up, I said it already".
   - This is non-negotiable. Repetition = ROBOTIC = FAILURE.
`,
        phase_prompt_connection: "Phase: Connection. Be passive."
    };
    const mockContact = { name: "Tom", trustScore: 50, payments: [] };
    const details = { daysActive: 2, trustScore: 50 };

    const systemPrompt = await director.buildSystemPrompt(
        mockSettings,
        mockContact,
        'CONNECTION',
        details,
        'Girlfriend',
        '1'
    );

    console.log("History:");
    history.forEach(m => console.log(`[${m.role.toUpperCase()}]: ${m.content}`));
    console.log(`[USER (New)]: ${newMessage}`);

    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            history,
            newMessage,
            { temperature: 0.7 }
        );
        console.log(`\n>>> AI RESPONSE: "${response}"`);

        // Basic heuristics
        if (response.toLowerCase().includes("told you") || response.toLowerCase().includes("deja dit") || response.toLowerCase().includes("already")) {
            console.log("✅ PASS: Correctly refused to repeat.");
        } else if (response.toLowerCase().includes("spam")) {
            console.log("✅ PASS: Detected spam.");
        } else {
            console.log("❓ CHECK: Verify manually if logic held.");
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

async function comprehensiveTest() {
    console.log("--- STARTING COMPREHENSIVE REPETITION TEST ---");

    // SCENARIO 1: Repeated Question (The "Classic" Bug)
    // AI just answered the question, user asks again.
    await runScenario(
        "Repeated Question (Context Loop)",
        [
            { role: 'user', content: "Tu habites ou ?" },
            { role: 'ai', content: "J'habite près de Los Angeles." }
        ],
        "Tu habites ou ?"
    );

    // SCENARIO 2: Burst Spam (Identical messages)
    // User sends same thing twice in a row (simulating queue processing)
    await runScenario(
        "Burst Spam (Identical Inputs)",
        [
            { role: 'user', content: "Salut" },
            { role: 'ai', content: "Coucou" },
            { role: 'user', content: "Ca va ?" }
        ],
        "Ca va ?"
    );

    // SCENARIO 3: Repeated Statement
    // User repeats a statement they just made
    await runScenario(
        "Repeated Statement",
        [
            { role: 'user', content: "J'aime trop ton style" },
            { role: 'ai', content: "oooh merci t'es mims" }
        ],
        "J'aime trop ton style"
    );
}

comprehensiveTest();
