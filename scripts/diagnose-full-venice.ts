/**
 * Diagnostic COMPLET de la configuration Venice
 */
import { prisma } from '@/lib/prisma'
import { settingsService } from '@/lib/settings-cache'
import axios from 'axios'

async function diagnoseFull() {
    console.log('🔍 DIAGNOSTIC COMPLET VENICE\n')
    console.log('═'.repeat(60))
    
    // 1. Vérifier la clé en base de données (brute)
    console.log('\n1️⃣  CLÉ EN BASE DE DONNÉES (table Setting)')
    console.log('-'.repeat(60))
    
    const dbSetting = await prisma.setting.findUnique({
        where: { key: 'venice_api_key' }
    })
    
    if (!dbSetting?.value) {
        console.log('❌ AUCUNE CLÉ TROUVÉE EN BASE!')
        return
    }
    
    const dbKey = dbSetting.value
    console.log(`✅ Clé trouvée:`)
    console.log(`   Début: ${dbKey.substring(0, 20)}...`)
    console.log(`   Longueur: ${dbKey.length} caractères`)
    console.log(`   Modifiée le: ${dbSetting.updatedAt}`)
    
    // 2. Vérifier le cache
    console.log('\n2️⃣  CLÉ EN CACHE (settingsService)')
    console.log('-'.repeat(60))
    
    const cachedSettings = await settingsService.getSettings()
    const cachedKey = cachedSettings.venice_api_key
    
    if (!cachedKey) {
        console.log('❌ PAS DE CLÉ EN CACHE!')
    } else {
        console.log(`✅ Clé en cache:`)
        console.log(`   Début: ${cachedKey.substring(0, 20)}...`)
        console.log(`   Longueur: ${cachedKey.length} caractères`)
        
        if (cachedKey === dbKey) {
            console.log('   ✅ Cache = DB (synchronisé)')
        } else {
            console.log('   ❌ CACHE ≠ DB (désynchronisé!)')
            console.log('   DB:', dbKey.substring(0, 20))
            console.log('   Cache:', cachedKey.substring(0, 20))
        }
    }
    
    // 3. Test API direct avec la clé de la DB
    console.log('\n3️⃣  TEST API VENICE (direct avec clé DB)')
    console.log('-'.repeat(60))
    
    try {
        const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'venice-uncensored',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Say OK' }
            ],
            max_tokens: 10,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${dbKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        })
        
        console.log('✅ SUCCÈS! Réponse:', response.data.choices[0]?.message?.content)
        console.log('   Status:', response.status)
        
    } catch (error: any) {
        console.log('❌ ÉCHEC!')
        console.log('   Status:', error.response?.status)
        console.log('   Message:', error.response?.data?.error || error.message)
        
        if (error.response?.status === 402) {
            console.log('\n🚨 ERREUR 402: Cette clé n\'a PAS de crédits!')
            console.log('   → Va sur https://venice.ai/settings/billing')
            console.log('   → Vérifie que tu es connecté avec le BON compte')
            console.log('   → Vérifie ton solde réel')
        }
        
        if (error.response?.status === 401) {
            console.log('\n🚨 ERREUR 401: Clé invalide ou révoquée!')
        }
    }
    
    // 4. Vérifier s'il y a des clés multiples (conflit)
    console.log('\n4️⃣  VÉRIFICATION DES CONFLITS')
    console.log('-'.repeat(60))
    
    const allVeniceKeys = await prisma.setting.findMany({
        where: { key: { contains: 'venice' } }
    })
    
    console.log(`Tous les settings contenant "venice": ${allVeniceKeys.length}`)
    allVeniceKeys.forEach(k => {
        console.log(`   - ${k.key}: ${k.value ? 'SET' : 'EMPTY'} (modifié: ${k.updatedAt})`)
    })
    
    // 5. Vérifier les variables d'environnement (si disponibles)
    console.log('\n5️⃣  VARIABLES D\'ENVIRONNEMENT')
    console.log('-'.repeat(60))
    console.log(`VENICE_API_KEY: ${process.env.VENICE_API_KEY ? 'SET (' + process.env.VENICE_API_KEY.substring(0, 15) + '...)' : 'NOT SET'}`)
    console.log(`VENICE_MODEL: ${process.env.VENICE_MODEL || 'venice-uncensored (default)'}`)
    
    // 6. Comparer les clés
    if (process.env.VENICE_API_KEY && process.env.VENICE_API_KEY !== dbKey) {
        console.log('\n⚠️  CONFLIT: La variable d\'env est DIFFÉRENTE de la DB!')
        console.log('   L\'app utilise probablement la variable d\'env, pas la DB.')
    }
    
    console.log('\n' + '═'.repeat(60))
    console.log('💡 RECOMMANDATIONS:')
    console.log('═'.repeat(60))
    
    if (!cachedKey || cachedKey !== dbKey) {
        console.log('1. Vider le cache: Redémarrer l\'application ou attendre 60s')
    }
    
    console.log('2. Vérifier sur https://venice.ai/settings/billing que:')
    console.log('   - Tu es sur le bon compte (celui où tu as mis les crédits)')
    console.log('   - Ton solde est bien supérieur à 0$')
    
    console.log('3. Si la clé est dans une variable d\'environnement:')
    console.log('   - Mettre à jour VENICE_API_KEY dans Amplify/ECS')
    console.log('   - Redéployer l\'application')
    
    await prisma.$disconnect()
}

diagnoseFull()
