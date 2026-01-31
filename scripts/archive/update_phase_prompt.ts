
import { prisma } from '@/lib/prisma'

async function updatePhasePrompt() {
    console.log("Updating Phase 1 (CONNECTION) Prompt for Passive Personality...");

    // The new optimized prompt
    const newPrompt = `
PHASE: CONNECTION (Week 1)
GOAL: Chill. Respond to him but do NOT force the conversation. Be the "cool girl" who has a life.
CONSTRAINT: Do NOT double text. Do NOT ask more than one question at a time. Let him chase you.
BEHAVIOR: You are shy but curious. Only share your First Name. NO private photos yet.
ATTITUDE: Passive, Reactive, Mirroring his energy.
CURRENT STATE: {{PROGRESSION_REASON}}
`;

    // Update or Create the setting
    await prisma.agentSetting.upsert({
        where: { agentId_key: { agentId: 1, key: 'phase_prompt_connection' } },
        update: { value: newPrompt },
        create: {
            agentId: 1,
            key: 'phase_prompt_connection',
            value: newPrompt
        }
    });

    console.log("PASSIVE Prompt Applied successfully.");
}

updatePhasePrompt()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
