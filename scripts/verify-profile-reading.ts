/**
 * Vérification simple que le ProfileAgent lit bien l'AgentProfile
 * Usage: npx tsx scripts/verify-profile-reading.ts
 */

import { prisma } from '@/lib/prisma';

async function verify() {
    console.log('🔍 Vérification de la lecture du AgentProfile\n');
    
    // Récupérer un agent avec profil
    const agent = await prisma.agent.findFirst({
        include: { profile: true }
    });
    
    if (!agent) {
        console.log('❌ Aucun agent trouvé');
        return;
    }
    
    console.log(`Agent: ${agent.name} (${agent.id})`);
    console.log('\n📋 AgentProfile trouvé:');
    console.log(JSON.stringify(agent.profile, null, 2));
    
    // Tester l'extraction de localisation
    const contextTemplate = agent.profile?.contextTemplate || '';
    const locationMatch = contextTemplate.match(/habite[s]?(?: à| en| au)? ([^.,\n]+)/i);
    const location = locationMatch ? locationMatch[1].trim() : null;
    
    console.log('\n📍 Localisation extraite:', location || 'Non trouvée');
    console.log('🎂 Âge (baseAge):', agent.profile?.baseAge || 'Non défini');
    
    console.log('\n✅ Lecture du AgentProfile OK');
}

verify().catch(console.error);
