/**
 * Test que {{PLATFORM}} est bien remplacé par WhatsApp ou Discord
 */

import { prisma } from '../lib/prisma';
import { runSwarm } from '../lib/swarm';

async function testPlatformVariable() {
  console.log("🧪 TEST VARIABLE {{PLATFORM}}\n");
  console.log("=" .repeat(60));
  
  const agentId = process.argv[2] || 'cmkvg0kzz00003vyv03zzt9kc';
  const timestamp = Date.now();
  
  // Test 1: WhatsApp
  console.log("\n📱 TEST 1: WhatsApp\n");
  const testPhone = `+33600000000${timestamp.toString().slice(-4)}`;
  
  const contactWA = await prisma.contact.create({
    data: {
      phone_whatsapp: testPhone,
      name: 'Test WhatsApp',
      source: 'test_platform',
    }
  });
  
  await prisma.agentContact.create({
    data: {
      agentId,
      contactId: contactWA.id,
      phase: 'CONNECTION',
      trustScore: 0,
      signals: [],
    }
  });
  
  // Message qui devrait trigger la safetyRule avec {{PLATFORM}}
  const responseWA = await runSwarm(
    "T'as snap ?",
    [],
    contactWA.id,
    agentId,
    'Test',
    'text',
    'whatsapp'  // <-- Plateforme WhatsApp
  );
  
  console.log(`[USER] T'as snap ?`);
  console.log(`[AI] ${responseWA}`);
  
  if (responseWA.toLowerCase().includes('whatsapp')) {
    console.log("✅ {{PLATFORM}} remplacé par 'WhatsApp'\n");
  } else {
    console.log("⚠️ Vérifier manuellement la réponse\n");
  }
  
  // Cleanup WhatsApp
  await cleanup(contactWA.id, agentId);
  
  // Test 2: Discord
  console.log("\n💬 TEST 2: Discord\n");
  const testPhone2 = `+33600000001${timestamp.toString().slice(-4)}`;
  
  const contactDC = await prisma.contact.create({
    data: {
      phone_whatsapp: testPhone2,
      name: 'Test Discord',
      source: 'test_platform',
    }
  });
  
  await prisma.agentContact.create({
    data: {
      agentId,
      contactId: contactDC.id,
      phase: 'CONNECTION',
      trustScore: 0,
      signals: [],
    }
  });
  
  const responseDC = await runSwarm(
    "T'as snap ?",
    [],
    contactDC.id,
    agentId,
    'Test',
    'text',
    'discord'  // <-- Plateforme Discord
  );
  
  console.log(`[USER] T'as snap ?`);
  console.log(`[AI] ${responseDC}`);
  
  if (responseDC.toLowerCase().includes('discord')) {
    console.log("✅ {{PLATFORM}} remplacé par 'Discord'\n");
  } else if (responseDC.toLowerCase().includes('whatsapp')) {
    console.log("❌ ERREUR: {{PLATFORM}} devrait être 'Discord' mais est 'WhatsApp'\n");
  } else {
    console.log("⚠️ Réponse neutre, vérifier le contexte\n");
  }
  
  // Cleanup Discord
  await cleanup(contactDC.id, agentId);
  
  console.log("=" .repeat(60));
  console.log("🏁 TEST TERMINÉ");
}

async function cleanup(contactId: string, agentId: string) {
  await prisma.message.deleteMany({
    where: { conversation: { contactId } }
  });
  await prisma.conversation.deleteMany({
    where: { contactId }
  });
  await prisma.agentContact.delete({
    where: {
      agentId_contactId: { agentId, contactId }
    }
  });
  await prisma.contact.delete({
    where: { id: contactId }
  });
}

testPlatformVariable().catch(console.error);
