
import { venice } from '@/lib/venice'

async function testPromptRepetition() {
    console.log("--- TESTING AI PROMPT REPITION LOGIC ---");

    // 1. Define the System Prompt with the new Rule
    const systemPrompt = `
You are a helpful assistant on WhatsApp.
[SHORT-TERM MEMORY]: If the history shows you JUST answered, do NOT repeat yourself. Acknowledge the spam or ignore.
`;

    // 2. Define History where AI JUST said something
    // Scenario: User asked "Price?", AI said "50 euros", User asks "Price?" again immediately (Burst).
    const history = [
        { role: 'user', content: 'C est combien?' },
        { role: 'ai', content: 'C est 50 euros.' } // This is the "Injected Context" from the previous burst part
    ];

    const newUserMessage = "C est combien?";

    console.log("System Prompt Rules:", systemPrompt);
    console.log("History:", history);
    console.log("New User Input:", newUserMessage);

    // 3. Call AI
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

        if (response.toLowerCase().includes('just told') || response.toLowerCase().includes('deja dit') || response.length < 10) {
            console.log("✅ SUCCESS: AI detected repetition.");
        } else if (response.includes('50 euros')) {
            console.log("❌ FAILURE: AI repeated the price.");
        } else {
            console.log("⚠️  UNCERTAIN: Check verify manually.");
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testPromptRepetition();
