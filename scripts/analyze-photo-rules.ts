import { prisma } from '../lib/prisma'

async function analyzePhotoRules() {
    console.log('🔍 ANALYSE DES RÈGLES PHOTOS EN BASE\n')
    console.log('=' .repeat(70))
    
    // 1. Vérifier les Media Types (catégories de photos)
    console.log('\n📁 MEDIA TYPES (catégories disponibles):')
    const mediaTypes = await prisma.mediaType.findMany()
    for (const mt of mediaTypes) {
        console.log(`   • ${mt.id}: ${mt.description || 'sans description'}`)
        console.log(`     Mots-clés: ${mt.keywords.slice(0, 5).join(', ')}...`)
    }
    
    // 2. Vérifier la blacklist
    console.log('\n🚫 BLACKLIST RULES:')
    const blacklist = await prisma.blacklistRule.findMany()
    for (const rule of blacklist) {
        console.log(`   • "${rule.term}" → interdit en phase: ${rule.phase}, type: ${rule.mediaType}`)
    }
    
    // 3. Vérifier les photos disponibles
    console.log('\n📸 MÉDIAS EN BANQUE:')
    const medias = await prisma.media.findMany({
        include: { type: true }
    })
    const byType: Record<string, number> = {}
    for (const m of medias) {
        byType[m.typeId] = (byType[m.typeId] || 0) + 1
    }
    for (const [typeId, count] of Object.entries(byType)) {
        console.log(`   • ${typeId}: ${count} photos`)
    }
    
    // 4. Vérifier les règles dans les profils
    console.log('\n📋 RÈGLES DANS AGENT PROFILES:')
    const profiles = await prisma.agentProfile.findMany({
        include: { agent: { select: { name: true } } }
    })
    
    for (const profile of profiles) {
        console.log(`\n🤖 Agent: ${profile.agent?.name || profile.agentId}`)
        
        // Chercher les mentions de photo dans safetyRules
        if (profile.safetyRules) {
            const photoMatches = profile.safetyRules.match(/photo|image|selfie|\[IMAGE/gi)
            if (photoMatches) {
                console.log(`   📸 Mentions "photo/image" dans safetyRules: ${photoMatches.length}`)
                // Extraire les lignes avec photo
                const lines = profile.safetyRules.split('\n')
                    .filter(l => /photo|image|selfie|\[IMAGE/i.test(l))
                    .slice(0, 5)
                lines.forEach(l => console.log(`      → ${l.trim().substring(0, 80)}`))
            } else {
                console.log('   ⚠️ Aucune mention de photo dans safetyRules')
            }
        }
        
        // Chercher dans styleRules
        if (profile.styleRules) {
            const photoMatches = profile.styleRules.match(/photo|image|selfie|\[IMAGE/gi)
            if (photoMatches) {
                console.log(`   🎨 Mentions "photo/image" dans styleRules: ${photoMatches.length}`)
            }
        }
        
        // Chercher dans paymentRules
        if (profile.paymentRules) {
            const photoMatches = profile.paymentRules.match(/photo|image|selfie|\[IMAGE/gi)
            if (photoMatches) {
                console.log(`   💰 Mentions "photo/image" dans paymentRules: ${photoMatches.length}`)
            }
        }
    }
    
    console.log('\n' + '='.repeat(70))
    console.log('✅ Analyse terminée')
}

analyzePhotoRules().catch(console.error)
