// Test du flow complet de gestion des photos
import { prisma } from '../lib/prisma'
import { mediaService } from '../lib/media'

async function testPhotoFlow() {
    console.log('🧪 TEST DU FLOW PHOTOS\n')
    console.log('=' .repeat(70))
    
    // Test 1: Analyser différents types de messages
    console.log('\n📨 TEST 1: Analyse de requêtes')
    
    const testMessages = [
        { text: "I like hiking reading camping take nature pics and eating", expected: false, desc: "Hobby (pics)" },
        { text: "Send me a photo of you", expected: true, desc: "Demande directe" },
        { text: "Show me your face", expected: true, desc: "Demande visage" },
        { text: "I love taking photos", expected: false, desc: "Hobby photo" },
        { text: "Can you send a selfie?", expected: true, desc: "Demande selfie" },
        { text: "Regarde la photo que j'ai prise", expected: false, desc: "Partage sa photo" },
    ]
    
    for (const test of testMessages) {
        console.log(`\n   Test: "${test.text}"`)
        console.log(`   Attendu: ${test.expected ? 'DEMANDE' : 'PAS DEMANDE'} (${test.desc})`)
        
        try {
            const result = await mediaService.analyzeRequest(
                test.text,
                '+33612345678',
                'test-agent',
                []
            )
            
            if (result) {
                const actual = result.isMediaRequest
                const status = actual === test.expected ? '✅' : '❌'
                console.log(`   Résultat: ${status} isMediaRequest=${actual}`)
                if (result.intentCategory) {
                    console.log(`   Catégorie: ${result.intentCategory}`)
                }
            } else {
                console.log('   ⚠️ Pas de résultat')
            }
        } catch (e) {
            console.log(`   ❌ Erreur: ${e}`)
        }
    }
    
    // Test 2: Vérifier les médias disponibles
    console.log('\n\n📸 TEST 2: Médias disponibles')
    const allMedias = await prisma.media.findMany({
        include: { type: true }
    })
    
    if (allMedias.length === 0) {
        console.log('   ⚠️ AUCUN média en banque!')
        console.log('   → Toute demande entraînera une requête à la source')
    } else {
        console.log(`   ✅ ${allMedias.length} médias trouvés`)
        for (const m of allMedias.slice(0, 5)) {
            console.log(`      • ${m.typeId}: ${m.url.substring(0, 50)}...`)
        }
    }
    
    // Test 3: ProcessRequest pour photo_visage
    console.log('\n\n🔍 TEST 3: ProcessRequest photo_visage')
    try {
        const result = await mediaService.processRequest('+33612345678', 'photo_visage')
        console.log(`   Action: ${result.action}`)
        if (result.action === 'SEND' && result.media) {
            console.log(`   ✅ Média trouvé: ${result.media.url.substring(0, 50)}...`)
        } else if (result.action === 'REQUEST_SOURCE') {
            console.log('   ⚠️ Aucun média disponible → demande à la source')
        }
    } catch (e) {
        console.log(`   ❌ Erreur: ${e}`)
    }
    
    console.log('\n' + '='.repeat(70))
    
    // Diagnostique
    console.log('\n📊 DIAGNOSTIQUE:')
    
    const mediaTypes = await prisma.mediaType.findMany()
    const medias = await prisma.media.findMany()
    
    console.log(`   • ${mediaTypes.length} types de médias définis`)
    console.log(`   • ${medias.length} médias en banque`)
    
    if (medias.length === 0) {
        console.log('\n   🚨 PROBLÈME: Aucune photo en banque!')
        console.log('   → Quand l\'IA génère [IMAGE:xxx], le système ne trouve rien')
        console.log('   → Cela crée une demande à la source (admin)')
        console.log('\n   💡 SOLUTION: Ajouter des photos dans la banque média')
    }
    
    console.log('\n✅ Test terminé')
}

testPhotoFlow().catch(console.error)
