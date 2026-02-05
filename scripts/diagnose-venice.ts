/**
 * Diagnostic tool for Venice AI API key
 */
import { prisma } from '@/lib/prisma'
import axios from 'axios'

async function diagnoseVenice() {
    console.log('🔍 DIAGNOSTIC VENICE AI\n')
    
    // 1. Get settings from DB
    const settings = await prisma.setting.findUnique({
        where: { key: 'venice_api_key' }
    })
    
    if (!settings?.value) {
        console.log('❌ Aucune clé API trouvée en base de données!')
        return
    }
    
    const apiKey = settings.value
    console.log('Clé API en base:')
    console.log(`  Début: ${apiKey.substring(0, 15)}...`)
    console.log(`  Longueur: ${apiKey.length} caractères`)
    console.log(`  Contient des espaces: ${apiKey.includes(' ') ? 'OUI ❌' : 'Non ✅'}`)
    console.log(`  Contient des retours à la ligne: ${apiKey.includes('\n') ? 'OUI ❌' : 'Non ✅'}`)
    
    // 2. Test avec l'API
    console.log('\n🧪 Test API Venice...')
    try {
        const response = await axios.post('https://api.venice.ai/api/v1/chat/completions', {
            model: 'venice-uncensored',
            messages: [
                { role: 'system', content: 'You are a helpful assistant. Reply with OK.' },
                { role: 'user', content: 'Say OK' }
            ],
            temperature: 0.1,
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        })
        
        console.log('✅ SUCCÈS! Réponse:', response.data.choices[0]?.message?.content)
        
    } catch (error: any) {
        const status = error.response?.status
        const data = error.response?.data
        
        console.error('\n❌ ERREUR API:')
        console.error(`  Status: ${status}`)
        console.error(`  Message: ${data?.error || error.message}`)
        
        if (status === 402) {
            console.error('\n🚨 ERREUR 402: Crédits insuffisants!')
            console.error('   → Va sur https://venice.ai/settings/billing')
            console.error('   → Vérifie ton solde réel')
            console.error('   → Essaye de régénérer une nouvelle clé API')
        }
        
        if (status === 401) {
            console.error('\n🚨 ERREUR 401: Clé invalide!')
            console.error('   → La clé a peut-être été révoquée')
            console.error('   → Génère une nouvelle clé sur https://venice.ai/settings/api')
        }
    }
    
    // 3. Check other Venice settings
    console.log('\n📋 Autres paramètres Venice:')
    const model = await prisma.setting.findUnique({ where: { key: 'venice_model' } })
    console.log(`  Modèle: ${model?.value || 'venice-uncensored (défaut)'}`)
    
    await prisma.$disconnect()
}

diagnoseVenice()
