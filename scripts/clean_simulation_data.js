const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PHONES = ['+33999999999', '33999999999', '+3381696', '+3346036']; // All test nums

async function clean() {
    console.log("🧹 Force Cleaning Simulation Data...");
    for (const p of PHONES) {
        console.log(`Checking ${p}...`);
        const c = await prisma.contact.findUnique({ where: { phone_whatsapp: p } });
        if (c) {
            console.log(`Found contact ${c.id}. Deleting conversations...`);
            await prisma.message.deleteMany({ where: { conversation: { contactId: c.id } } });
            await prisma.conversation.deleteMany({ where: { contactId: c.id } });
            await prisma.contact.delete({ where: { id: c.id } });
            console.log(`Deleted ${p}.`);
        } else {
            console.log(`Contact ${p} not found.`);
        }
    }
}

clean()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
