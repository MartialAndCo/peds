/**
 * Recherche exhaustive de "17" dans toute la base de données
 */

import { prisma } from '../lib/prisma';

async function searchAge17() {
  console.log("🔍 RECHERCHE EXHAUSTIVE DE '17' DANS LA BASE DE DONNÉES\n");
  console.log("=".repeat(70));
  
  let totalFound = 0;
  
  // 1. AgentProfile - tous les champs texte
  console.log("\n📋 1. AGENT PROFILE\n");
  const profiles = await prisma.agentProfile.findMany();
  
  for (const profile of profiles) {
    const fields = [
      { name: 'contextTemplate', value: profile.contextTemplate },
      { name: 'missionTemplate', value: profile.missionTemplate },
      { name: 'identityTemplate', value: profile.identityTemplate },
      { name: 'paymentRules', value: profile.paymentRules },
      { name: 'safetyRules', value: profile.safetyRules },
      { name: 'styleRules', value: profile.styleRules },
      { name: 'phaseConnectionTemplate', value: profile.phaseConnectionTemplate },
      { name: 'phaseVulnerabilityTemplate', value: profile.phaseVulnerabilityTemplate },
      { name: 'phaseCrisisTemplate', value: profile.phaseCrisisTemplate },
      { name: 'phaseMoneypotTemplate', value: profile.phaseMoneypotTemplate },
    ];
    
    for (const field of fields) {
      if (field.value && /\b17\b/.test(field.value)) {
        console.log(`   🚨 Agent ${profile.agentId} - ${field.name}`);
        // Extraire le contexte
        const lines = field.value.split('\n');
        const matchingLines = lines.filter(l => /\b17\b/.test(l));
        matchingLines.forEach(line => {
          console.log(`      "${line.trim().substring(0, 100)}"`);
        });
        totalFound++;
      }
    }
  }
  
  // 2. Agent table
  console.log("\n🤖 2. AGENT (noms, descriptions)\n");
  const agents = await prisma.agent.findMany();
  for (const agent of agents) {
    const text = `${agent.name} ${agent.description || ''}`;
    if (/\b17\b/.test(text)) {
      console.log(`   🚨 Agent ${agent.id}: "${text.substring(0, 100)}"`);
      totalFound++;
    }
  }
  
  // 3. Settings
  console.log("\n⚙️  3. SETTINGS\n");
  const settings = await prisma.setting.findMany();
  for (const setting of settings) {
    if (setting.value && /\b17\b/.test(setting.value)) {
      console.log(`   🚨 Setting ${setting.key}: "${setting.value.substring(0, 100)}"`);
      totalFound++;
    }
  }
  
  // 4. AgentSettings
  console.log("\n⚙️  4. AGENT SETTINGS\n");
  const agentSettings = await prisma.agentSetting.findMany();
  for (const setting of agentSettings) {
    if (setting.value && /\b17\b/.test(setting.value)) {
      console.log(`   🚨 Agent ${setting.agentId} - ${setting.key}: "${setting.value.substring(0, 100)}"`);
      totalFound++;
    }
  }
  
  // 5. Prompts (si table existe)
  try {
    console.log("\n📝 5. PROMPTS\n");
    const prompts = await prisma.prompt.findMany();
    for (const prompt of prompts) {
      if (prompt.system_prompt && /\b17\b/.test(prompt.system_prompt)) {
        console.log(`   🚨 Prompt ${prompt.id}: trouvé '17'`);
        totalFound++;
      }
    }
  } catch (e) {
    console.log("   (Table Prompt non trouvée)");
  }
  
  // 6. Messages historiques (où l'IA a dit 17)
  console.log("\n💬 6. MESSAGES HISTORIQUES (où l'IA a dit 17)\n");
  const messages = await prisma.message.findMany({
    where: {
      sender: 'ai',
      message_text: { contains: '17' }
    },
    take: 20,
    orderBy: { timestamp: 'desc' }
  });
  
  for (const msg of messages) {
    if (/\b17\b/.test(msg.message_text)) {
      console.log(`   🚨 Message ${msg.id}: "${msg.message_text.substring(0, 80)}..."`);
      totalFound++;
    }
  }
  
  // 7. Conversations (metadata, notes)
  console.log("\n💭 7. CONVERSATIONS (notes, contexte)\n");
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { notes: { contains: '17' } },
        { context: { contains: '17' } }
      ]
    },
    take: 10
  });
  
  for (const conv of conversations) {
    console.log(`   🚨 Conversation ${conv.id}: trouvé '17'`);
    totalFound++;
  }
  
  // 8. Contacts (notes)
  console.log("\n👤 8. CONTACTS (notes)\n");
  const contacts = await prisma.contact.findMany({
    where: { notes: { contains: '17' } },
    take: 10
  });
  
  for (const contact of contacts) {
    console.log(`   🚨 Contact ${contact.id}: "${contact.notes?.substring(0, 80)}..."`);
    totalFound++;
  }
  
  // 9. Memories (où l'IA a mémorisé son âge)
  try {
    console.log("\n🧠 9. MEMORIES\n");
    const memories = await prisma.$queryRaw`
      SELECT * FROM Memory WHERE content LIKE '%17%'
    `;
    console.log(`   ${(memories as any[]).length} memories contiennent '17'`);
  } catch (e) {
    console.log("   (Table Memory non accessible)");
  }
  
  console.log("\n" + "=".repeat(70));
  console.log(`📊 TOTAL: ${totalFound} occurrences de '17' trouvées`);
  
  if (totalFound === 0) {
    console.log("\n✅ Aucune occurrence de '17' trouvée dans la DB!");
  } else {
    console.log("\n⚠️  Des occurrences de '17' ont été trouvées ci-dessus");
  }
}

searchAge17().catch(console.error);
