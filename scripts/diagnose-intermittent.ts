import { prisma } from '../lib/prisma';

async function main() {
  console.log('🔍 DIAGNOSTIC MESSAGES INTERMITTENTS\n');
  const now = new Date();
  
  // 1. Messages bloqués en PROCESSING depuis longtemps
  const stuckProcessing = await prisma.messageQueue.findMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: new Date(now.getTime() - 2 * 60000) } // >2min
    },
    include: { contact: { select: { phone_whatsapp: true, name: true } } },
    orderBy: { updatedAt: 'asc' }
  });
  
  console.log(`🔄 Messages bloqués en PROCESSING (>2min): ${stuckProcessing.length}`);
  for (const m of stuckProcessing) {
    const stuckMin = Math.round((now.getTime() - m.updatedAt.getTime()) / 60000);
    console.log(`   - ${m.id.substring(0,8)} | ${m.contact?.name} | bloqué depuis ${stuckMin}min`);
    console.log(`     "${m.content?.substring(0,40)}..."`);
  }
  
  // 2. Messages PENDING qui devraient partir
  const shouldSend = await prisma.messageQueue.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now }
    },
    include: { contact: { select: { phone_whatsapp: true, name: true } } },
    orderBy: { scheduledAt: 'asc' },
    take: 5
  });
  
  console.log(`\n📤 Messages PENDING à envoyer maintenant: ${shouldSend.length}`);
  for (const m of shouldSend) {
    const delayMin = Math.round((now.getTime() - m.scheduledAt.getTime()) / 60000);
    console.log(`   - ${m.id.substring(0,8)} | ${m.contact?.name} | retard ${delayMin}min`);
  }
  
  // 3. Stats des derniers envois
  const recentSent = await prisma.messageQueue.findMany({
    where: {
      status: 'SENT',
      updatedAt: { gt: new Date(now.getTime() - 60 * 60000) } // Dernière heure
    },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });
  
  console.log(`\n✅ Messages envoyés dernière heure: ${recentSent.length}`);
  for (const m of recentSent) {
    const sentMin = Math.round((now.getTime() - m.updatedAt.getTime()) / 60000);
    console.log(`   - Il y a ${sentMin}min: "${m.content?.substring(0,30)}..."`);
  }
  
  // 4. Erreurs récentes
  const recentFailed = await prisma.messageQueue.findMany({
    where: {
      status: 'FAILED',
      updatedAt: { gt: new Date(now.getTime() - 60 * 60000) }
    },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });
  
  console.log(`\n❌ Messages FAILED dernière heure: ${recentFailed.length}`);
  for (const m of recentFailed) {
    const failMin = Math.round((now.getTime() - m.updatedAt.getTime()) / 60000);
    console.log(`   - Il y a ${failMin}min | Attempts: ${m.attempts}`);
  }
  
  // 5. Historique sur 24h
  const stats24h = await prisma.messageQueue.groupBy({
    by: ['status'],
    where: { updatedAt: { gt: new Date(now.getTime() - 24 * 60 * 60000) } },
    _count: { status: true }
  });
  
  console.log(`\n📊 Stats 24h:`);
  for (const s of stats24h) {
    console.log(`   ${s.status}: ${s._count.status}`);
  }
  
  await prisma.$disconnect();
}

main();
