import { prisma } from '../lib/prisma';

async function main() {
  const msg = await prisma.messageQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { scheduledAt: 'asc' },
    include: { contact: { select: { name: true } } }
  });
  
  if (msg) {
    const now = new Date();
    const delay = Math.round((now.getTime() - msg.scheduledAt.getTime()) / 60000);
    console.log(`Message PENDING: ${msg.id.substring(0,8)}`);
    console.log(`Contact: ${msg.contact?.name}`);
    console.log(`Retard: ${delay} minutes`);
    console.log(`Content: "${msg.content?.substring(0,50)}..."`);
  } else {
    console.log('Aucun message PENDING');
  }
  
  await prisma.$disconnect();
}

main();
