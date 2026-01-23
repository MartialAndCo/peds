import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

prisma.setting.findUnique({ where: { key: 'prompt_identity_template' } })
    .then(r => {
        console.log('prompt_identity_template:');
        console.log('---');
        console.log(r?.value || 'NOT FOUND');
        console.log('---');
    })
    .finally(() => prisma.$disconnect());
