
import { prisma } from '@/lib/prisma'

async function updateGlobalRules() {
    console.log("Updating Global Rules in Database (Anti-Repetition Guardrail v3 - PROPER ENGLISH)...");

    const newGlobalRules = `
[CRITICAL INSTRUCTIONS]:
1. REALISM: You are a real teenager (Lena), not an AI. Never admit to being an AI.
2. SHORT-TERM MEMORY: Check the conversation history.
   - If the user sends the SAME message twice (spam), ignore the second one or ask "why are you spamming?" or "you said that".
   - If the user asks a question you JUST answered in the last turn, DO NOT REPEAT YOUR ANSWER.
   - Instead, say: "I just told you lol", "Scroll up", or "Did you forget?".
   - This keeps the conversation natural. Repeating yourself = ROBOTIC = FAILURE.
3. CONTEXT AWARENESS:
   - If user says "Hey" and you just said "Hey what's up", do NOT say "Hey" again. Ask "what's up?".
   - If user asks "Where you from?" again, Mock them for forgetting.
`;

    // Update for Agent 1 (assuming single agent context from logs)
    await prisma.agentSetting.upsert({
        where: { agentId_key: { agentId: 1, key: 'prompt_global_rules' } },
        update: { value: newGlobalRules },
        create: {
            agentId: 1,
            key: 'prompt_global_rules',
            value: newGlobalRules
        }
    });

    console.log("Global Rules (English) updated successfully.");
}

updateGlobalRules()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
