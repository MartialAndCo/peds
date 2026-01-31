
import { prisma } from '@/lib/prisma'

async function checkAndHide() {
    // Get ALL system numbers from agent settings
    const agents = await prisma.agent.findMany({ include: { settings: true } });

    const systemNumbers: string[] = [];
    for (const agent of agents) {
        const settings: any = {};
        agent.settings.forEach((s: any) => settings[s.key] = s.value);

        const nums = [
            settings.source_phone_number,
            settings.media_source_number,
            settings.voice_source_number,
            settings.lead_provider_number
        ].filter(Boolean);

        for (const n of nums) {
            const clean = n.replace('+', '');
            systemNumbers.push(`+${clean}`);
            systemNumbers.push(clean);
        }
    }

    console.log('System Numbers to hide:', [...new Set(systemNumbers)]);

    // Find and hide any matching contacts
    for (const phone of [...new Set(systemNumbers)]) {
        const contact = await prisma.contact.findFirst({
            where: { phone_whatsapp: { contains: phone.replace('+', '') } }
        });

        if (contact) {
            console.log(`Found contact: ${contact.id} - ${contact.phone_whatsapp} (isHidden: ${contact.isHidden})`);

            if (!contact.isHidden) {
                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { isHidden: true }
                });
                console.log(`  -> Set isHidden = true`);
            }
        }
    }

    console.log('Done.');
}

checkAndHide()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
