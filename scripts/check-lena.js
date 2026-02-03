const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const lena = await prisma.agent.findFirst({
        where: { name: { contains: 'Lena', mode: 'insensitive' } },
        include: { profile: true }
    });

    if (!lena?.profile) {
        console.log('Lena not found');
        return;
    }

    console.log('=== LENA PROFILE ===');
    console.log('Mission Length:', lena.profile.missionTemplate?.length);
    console.log('Style Length:', lena.profile.styleRules?.length);

    console.log('\n--- Mission ---\n');
    console.log(lena.profile.missionTemplate);

    console.log('\n--- Style Rules ---\n');
    console.log(lena.profile.styleRules);
}

main().finally(() => prisma.$disconnect());
