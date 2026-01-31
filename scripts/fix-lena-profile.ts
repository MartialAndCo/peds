
import { prisma } from '../lib/prisma';

async function main() {
    const agent = await prisma.agent.findFirst({
        where: { name: { contains: 'Lena', mode: 'insensitive' } },
        include: { profile: true }
    });

    if (!agent || !agent.profile) {
        console.error("Agent Lena not found or has no profile!");
        return;
    }

    console.log(`Fixing Agent: ${agent.name} (${agent.id})`);

    // Helper to replace hardcoded examples globally
    const replacer = (text: string | null) => {
        if (!text) return text;
        // Simple global replace of the problematic string
        return text.replace(/lena9200/g, 'lena.lastname');
    };

    const newPaymentRules = replacer(agent.profile.paymentRules);
    const newStyleRules = replacer(agent.profile.styleRules);
    const newPhaseCrisis = replacer(agent.profile.phaseCrisisTemplate);
    const newPhaseMoneypot = replacer(agent.profile.phaseMoneypotTemplate);

    // Update DB
    await prisma.agentProfile.update({
        where: { id: agent.profile.id },
        data: {
            paymentRules: newPaymentRules,
            styleRules: newStyleRules,
            phaseCrisisTemplate: newPhaseCrisis,
            phaseMoneypotTemplate: newPhaseMoneypot,
        }
    });

    console.log("SUCCESS: Lena profile examples updated (Global override).");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
