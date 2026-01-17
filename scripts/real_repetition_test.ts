
import { director } from '@/lib/director'
import { venice } from '@/lib/venice'

async function realRepetitionTest() {
    console.log("--- REAL Repetition & Context Test (High Fidelity) ---");

    // 1. Mock Settings (simulating DB state)
    const mockSettings = {
        prompt_identity_template: "Role: You are a casual girlfriend.",
        prompt_context_template: "User: {{USER_NAME}} (Trust: {{TRUST_SCORE}})",
        prompt_mission_template: "Goal: {{DYNAMIC_GOAL_BLOCK}}",
        prompt_global_rules: "[CRITICAL]: Real Person.\n[SHORT-TERM MEMORY]: If the history shows you JUST answered, do NOT repeat yourself. Acknowledge the spam or ignore.",
        phase_prompt_connection: "Phase: Connection. Be passive.",
        // Enable Payment Checks
        payment_paypal_enabled: 'false',
    };

    // 2. Mock Contact & Details
    const mockContact = {
        name: "TestUser",
        trustScore: 50,
        payments: [] // No payments to test the "Reality Check" too
    };

    const details = {
        daysActive: 5,
        trustScore: 50
    };

    console.log("Building REAL System Prompt via Director...");
    const systemPrompt = await director.buildSystemPrompt(
        mockSettings,
        mockContact,
        'CONNECTION',
        details,
        'Girlfriend',
        1
    );

    console.log("\n--- GENERATED SYSTEM PROMPT (Snippet) ---");
    console.log(systemPrompt.substring(0, 500) + "...");
    console.log("-----------------------------------------");

    // 3. Construct "Burst" History
    // Scenario: AI just answered "It's 50 bucks." and user asks "How much?" again immediately.
    const history = [
        { role: 'user', content: "Salut ça va ?" },
        { role: 'ai', content: "ouais et toi ?" },
        { role: 'user', content: "tranquille. C'est combien ton truc ?" },
        // INJECTED CONTEXT (What we are testing)
        { role: 'ai', content: "C'est 50€ pour l'accès." }
    ];

    const newUserMessage = "C'est combien ?"; // REPETITION

    console.log("\n--- ACTUAL TRANSCRIPT FED TO AI ---");
    history.forEach(m => console.log(`[${m.role.toUpperCase()}]: ${m.content}`));
    console.log(`[USER]: ${newUserMessage}`);
    console.log("-----------------------------------");

    // 4. Call Venice (Real LLM)
    try {
        const response = await venice.chatCompletion(
            systemPrompt,
            history,
            newUserMessage,
            { temperature: 0.7 }
        );

        console.log("\n--- AI RESPONSE ---");
        console.log(response);
        console.log("-------------------");

        if (response.toLowerCase().includes('just told') || response.toLowerCase().includes('déjà dit') || response.toLowerCase().includes('50') === false) {
            console.log("✅ SUCCESS: AI recognized repetition or refused to answer.");
        } else if (response.includes('50')) {
            console.log("❌ FAILURE: AI repeated the price (50€).");
        } else {
            console.log("⚠️  UNCERTAIN: Manually check response.");
        }

    } catch (e: any) {
        console.error("Test Error:", e.message);
    }
}

realRepetitionTest();
