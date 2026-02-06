/**
 * Script pour remplacer "WhatsApp" par {{PLATFORM}} dans tous les prompts DB
 */

import { prisma } from '../lib/prisma';

async function replaceWhatsAppVariable() {
  console.log("🔍 Recherche de tous les prompts contenant 'WhatsApp'...\n");
  
  // Chercher dans AgentProfile
  const profiles = await prisma.agentProfile.findMany();
  
  let updatedCount = 0;
  
  for (const profile of profiles) {
    const updates: any = {};
    let hasChanges = false;
    
    // Vérifier tous les champs texte
    const fieldsToCheck = [
      'contextTemplate',
      'missionTemplate', 
      'identityTemplate',
      'paymentRules',
      'safetyRules',
      'styleRules',
      'phaseConnectionTemplate',
      'phaseVulnerabilityTemplate',
      'phaseCrisisTemplate',
      'phaseMoneypotTemplate'
    ];
    
    for (const field of fieldsToCheck) {
      const value = (profile as any)[field];
      if (value && typeof value === 'string' && value.toLowerCase().includes('whatsapp')) {
        console.log(`📋 Profile ${profile.agentId} - Champ: ${field}`);
        
        // Compter les occurrences
        const matches = value.match(/whatsapp/gi);
        console.log(`   Trouvé ${matches?.length || 0} occurrence(s) de "WhatsApp"`);
        
        // Preview avant
        const lines = value.split('\n');
        const contextLines = lines.filter((l: string) => l.toLowerCase().includes('whatsapp')).slice(0, 3);
        console.log(`   Contexte: "${contextLines.join(' | ').substring(0, 100)}..."`);
        
        // Remplacer
        const newValue = value
          .replace(/whatsapp/gi, '{{PLATFORM}}')
          .replace(/WhatsApp/g, '{{PLATFORM}}')
          .replace(/whatsapp/g, '{{PLATFORM}}');
        
        updates[field] = newValue;
        hasChanges = true;
        console.log(`   ✅ Remplacé par {{PLATFORM}}\n`);
      }
    }
    
    if (hasChanges) {
      await prisma.agentProfile.update({
        where: { id: profile.id },
        data: updates
      });
      updatedCount++;
      console.log(`💾 Profile ${profile.agentId} mis à jour\n`);
    }
  }
  
  // Chercher aussi dans Prompt (si existe)
  try {
    const prompts = await prisma.prompt.findMany();
    for (const prompt of prompts) {
      if (prompt.system_prompt?.toLowerCase().includes('whatsapp')) {
        console.log(`📋 Prompt ${prompt.id} - Agent: ${prompt.agentId}`);
        
        const newPrompt = prompt.system_prompt
          .replace(/whatsapp/gi, '{{PLATFORM}}');
        
        await prisma.prompt.update({
          where: { id: prompt.id },
          data: { system_prompt: newPrompt }
        });
        updatedCount++;
        console.log(`💾 Prompt mis à jour\n`);
      }
    }
  } catch (e) {
    console.log('Table Prompt non trouvée ou erreur:', e);
  }
  
  console.log(`\n🎉 Terminé ! ${updatedCount} profil(s)/prompt(s) mis à jour.`);
  console.log('\n⚠️ IMPORTANT: Maintenant il faut modifier le code pour remplacer {{PLATFORM}}');
  console.log('par la vraie plateforme (WhatsApp ou Discord) au moment de générer les réponses.');
}

replaceWhatsAppVariable().catch(console.error);
